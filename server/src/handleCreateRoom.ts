
/**
 * CREATE_ROOM signaling handler.
 * Does not implement JOIN_ROOM, LEAVE_ROOM, or WebRTC.
 */

import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  ROOM_CONFIG,
  SignalingMessageType,
  validateDisplayName,
  type AnySignalingMessage,
  type ErrorMessage,
  type RoomCreatedMessage,
} from '@screenshare/shared';
import { createErrorMessage } from './parseMessage.js';
import type { ClientConnection, RoomManager } from './RoomManager.js';

export type CreateRoomResponse = RoomCreatedMessage | ErrorMessage;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function validateMaxParticipantsIfPresent(payload: Record<string, unknown>): ErrorMessage | null {
  if (!Object.prototype.hasOwnProperty.call(payload, 'maxParticipants')) {
    return null;
  }

  const maxParticipants = payload['maxParticipants'];
  if (
    typeof maxParticipants !== 'number' ||
    !Number.isInteger(maxParticipants) ||
    maxParticipants < 1 ||
    maxParticipants > ROOM_CONFIG.MAX_PARTICIPANTS
  ) {
    return createErrorMessage(
      'INVALID_MAX_PARTICIPANTS',
      `Participant limit must be an integer between 1 and ${String(ROOM_CONFIG.MAX_PARTICIPANTS)}`,
    );
  }

  return null;
}

/**
 * Creates a room for the connected client and returns ROOM_CREATED or ERROR.
 * Does not send on the socket — the caller is responsible for transmitting the response.
 */
export function handleCreateRoom(
  ws: WebSocket,
  message: AnySignalingMessage,
  roomManager: RoomManager,
): CreateRoomResponse {
  if (message.type !== SignalingMessageType.CREATE_ROOM) {
    return createErrorMessage('INVALID_MESSAGE', 'Expected CREATE_ROOM message');
  }

  const payload = asRecord('payload' in message ? message.payload : undefined);
  if (!payload) {
    return createErrorMessage('INVALID_PAYLOAD', 'CREATE_ROOM requires a payload object');
  }

  const nameResult = validateDisplayName(payload['displayName']);
  if (!nameResult.valid) {
    return createErrorMessage(
      'INVALID_DISPLAY_NAME',
      nameResult.error ?? 'Invalid display name',
    );
  }

  const maxParticipantsError = validateMaxParticipantsIfPresent(payload);
  if (maxParticipantsError) {
    return maxParticipantsError;
  }

  const displayName = String(payload['displayName']).trim();

  try {
    const code = roomManager.generateUniqueCode();
    const host: ClientConnection = {
      id: uuidv4(),
      displayName,
      ws,
      isHost: true,
      joinedAt: Date.now(),
    };
    const room = roomManager.createRoom(host, code);

    const response: RoomCreatedMessage = {
      type: SignalingMessageType.ROOM_CREATED,
      payload: {
        roomCode: room.code,
        participantId: host.id,
      },
    };
    return response;
  } catch {
    return createErrorMessage('INTERNAL_ERROR', 'Failed to create room');
  }
}