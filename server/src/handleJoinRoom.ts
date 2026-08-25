/**
 * JOIN_ROOM signaling handler.
 */

import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  SignalingMessageType,
  validateDisplayName,
  validateRoomCode,
  type AnySignalingMessage,
  type ErrorMessage,
  type RoomJoinedMessage,

  type SignalingMessage,
} from '@screenshare/shared';
import { createErrorMessage } from './parseMessage.js';
import type { ClientConnection, RoomManager } from './RoomManager.js';

export type JoinRoomResponse = { response: RoomJoinedMessage; broadcast?: SignalingMessage } | ErrorMessage;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * Handles JOIN_ROOM requests from clients.
 * Returns ROOM_JOINED on success, ERROR on failure.
 * Also returns a broadcast message to notify other participants.
 */
export function handleJoinRoom(
  ws: WebSocket,
  message: AnySignalingMessage,
  roomManager: RoomManager,
): JoinRoomResponse {
  if (message.type !== SignalingMessageType.JOIN_ROOM) {
    return createErrorMessage('INVALID_MESSAGE', 'Expected JOIN_ROOM message');
  }

  const payload = asRecord('payload' in message ? message.payload : undefined);
  if (!payload) {
    return createErrorMessage('INVALID_PAYLOAD', 'JOIN_ROOM requires a payload object');
  }

  const roomCodeResult = validateRoomCode(payload['roomCode']);
  if (!roomCodeResult.valid) {
    return createErrorMessage('INVALID_ROOM_CODE', roomCodeResult.error ?? 'Invalid room code');
  }

  const nameResult = validateDisplayName(payload['displayName']);
  if (!nameResult.valid) {
    return createErrorMessage('INVALID_DISPLAY_NAME', nameResult.error ?? 'Invalid display name');
  }

  const roomCode = String(payload['roomCode']).trim().toUpperCase();
  const displayName = String(payload['displayName']).trim();

  const room = roomManager.getRoomByCode(roomCode);
  if (!room) {
    return createErrorMessage('ROOM_NOT_FOUND', 'Room not found or does not exist');
  }

  if (room.state === 'CLOSED') {
    return createErrorMessage('ROOM_CLOSED', 'Room has been closed');
  }

  if (room.participantCount >= 20) {
    return createErrorMessage('ROOM_FULL', 'Room is at maximum capacity');
  }

  const viewer: ClientConnection = {
    id: uuidv4(),
    displayName,
    ws,
    isHost: false,
    joinedAt: Date.now(),
  };

  const added = room.addViewer(viewer);
  if (!added) {
    return createErrorMessage('ROOM_FULL', 'Room is at maximum capacity');
  }

  roomManager.addClientToRoom(viewer.id, room);

  const response: RoomJoinedMessage = {
    type: SignalingMessageType.ROOM_JOINED,
    payload: {
      roomCode: room.code,
      participantId: viewer.id,
      hostId: room.host.id,
      hostDisplayName: room.host.displayName,
      participants: room.getParticipants(),
    },
  };

  // Create broadcast message to notify other participants
  const broadcastMessage = {
    type: SignalingMessageType.PARTICIPANT_JOINED,
    payload: {
      participant: {
        id: viewer.id,
        displayName: viewer.displayName,
        isHost: false,
        isSharing: false,
        joinedAt: viewer.joinedAt,
      },
    },
  };

  return { response, broadcast: broadcastMessage };
}
