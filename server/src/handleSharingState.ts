/** Validates and broadcasts participant screen-sharing state changes. */

import type { WebSocket } from 'ws';
import {
  SignalingMessageType,
  type AnySignalingMessage,
  type ErrorMessage,
  type ParticipantSharingChangedMessage,
} from '@screenshare/shared';
import { createErrorMessage } from './parseMessage.js';
import type { RoomManager } from './RoomManager.js';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

/** Updates server state and returns a canonical message for room broadcast. */
export function handleSharingState(
  ws: WebSocket,
  message: AnySignalingMessage,
  roomManager: RoomManager,
): ParticipantSharingChangedMessage | ErrorMessage | null {
  if (message.type !== SignalingMessageType.PARTICIPANT_SHARING_CHANGED) {
    return createErrorMessage('INVALID_MESSAGE', 'Expected sharing state message');
  }

  const payload = asRecord(message.payload);
  if (
    !payload
    || typeof payload['roomCode'] !== 'string'
    || typeof payload['participantId'] !== 'string'
    || typeof payload['isSharing'] !== 'boolean'
  ) {
    return createErrorMessage(
      'INVALID_SHARING_PAYLOAD',
      'Sharing state requires roomCode, participantId, and isSharing',
    );
  }

  const roomCode = payload['roomCode'];
  const participantId = payload['participantId'];
  const room = roomManager.getClientRoom(participantId);
  const participant = room && (room.host.id === participantId ? room.host : room.viewers.get(participantId));
  if (!room || room.code !== roomCode || participant?.ws !== ws) {
    return createErrorMessage('PARTICIPANT_NOT_IN_ROOM', 'Participant does not belong to the specified room');
  }

  const isSharing = payload['isSharing'];
  if (!room.setParticipantSharing(participantId, isSharing)) {
    return createErrorMessage('PARTICIPANT_NOT_FOUND', 'Participant not found in room');
  }

  return {
    type: SignalingMessageType.PARTICIPANT_SHARING_CHANGED,
    payload: { roomCode, participantId, isSharing },
  };
}
