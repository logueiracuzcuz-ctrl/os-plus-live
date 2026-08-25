/**
 * LEAVE_ROOM signaling handler.
 */

import type { WebSocket } from 'ws';
import {
  SignalingMessageType,
  type AnySignalingMessage,
  type ErrorMessage,
  type ParticipantLeftMessage,
} from '@screenshare/shared';
import { createErrorMessage } from './parseMessage.js';
import type { RoomManager } from './RoomManager.js';

export type LeaveRoomResponse = ParticipantLeftMessage | ErrorMessage | null;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * Handles LEAVE_ROOM requests from clients.
 * Returns PARTICIPANT_LEFT on success, ERROR on failure, or null if no room.
 */
export function handleLeaveRoom(
  ws: WebSocket,
  message: AnySignalingMessage,
  roomManager: RoomManager,
): LeaveRoomResponse {
  if (message.type !== SignalingMessageType.LEAVE_ROOM) {
    return createErrorMessage('INVALID_MESSAGE', 'Expected LEAVE_ROOM message');
  }

  const payload = asRecord('payload' in message ? message.payload : undefined);
  if (!payload) {
    return createErrorMessage('INVALID_PAYLOAD', 'LEAVE_ROOM requires a payload object');
  }

  const participantId = payload['participantId'];
  if (typeof participantId !== 'string' || !participantId.trim()) {
    return createErrorMessage('INVALID_PARTICIPANT_ID', 'Valid participant ID is required');
  }

  const room = roomManager.getClientRoom(participantId);
  if (!room) {
    return null; // Not in a room, nothing to do
  }

  const participant = room.host.id === participantId ? room.host : room.viewers.get(participantId);
  if (!participant) {
    return createErrorMessage('PARTICIPANT_NOT_FOUND', 'Participant not found in room');
  }
  if (participant.ws !== ws) {
    return createErrorMessage('PARTICIPANT_NOT_FOUND', 'Participant does not belong to this connection');
  }

  roomManager.removeClient(participantId);

  const response: ParticipantLeftMessage = {
    type: SignalingMessageType.PARTICIPANT_LEFT,
    payload: {
      participantId: participant.id,
      displayName: participant.displayName,
    },
  };

  return response;
}
