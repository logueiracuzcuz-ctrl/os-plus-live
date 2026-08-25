/** Validates and routes WebRTC signaling messages within one room. */

import type { WebSocket } from 'ws';
import {
  SignalingMessageType,
  type ErrorMessage,
  type IceCandidateMessage,
  type WebRtcAnswerMessage,
  type WebRtcOfferMessage,
} from '@screenshare/shared';
import { createErrorMessage } from './parseMessage.js';
import type { ClientConnection, RoomManager } from './RoomManager.js';

export type WebRtcSignalMessage =
  | WebRtcOfferMessage
  | WebRtcAnswerMessage
  | IceCandidateMessage;

export interface WebRtcRelay {
  target: ClientConnection;
  message: WebRtcSignalMessage;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : undefined;
}

function hasString(record: UnknownRecord, key: string): boolean {
  return typeof record[key] === 'string' && record[key] !== '';
}

function isSessionDescription(value: unknown, expectedType: 'offer' | 'answer'): value is RTCSessionDescriptionInit {
  const record = asRecord(value);
  return record !== undefined && record['type'] === expectedType && typeof record['sdp'] === 'string';
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  const record = asRecord(value);
  if (!record) return false;
  const candidate = record['candidate'];
  return candidate === undefined || typeof candidate === 'string';
}

function validateRouting(payload: UnknownRecord): ErrorMessage | null {
  for (const field of ['roomCode', 'participantId', 'targetId']) {
    if (!hasString(payload, field)) {
      return createErrorMessage('INVALID_WEBRTC_PAYLOAD', `${field} is required`);
    }
  }
  return null;
}

function participantForId(
  roomManager: RoomManager,
  participantId: string,
): { room: ReturnType<RoomManager['getClientRoom']>; participant: ClientConnection | undefined } {
  const room = roomManager.getClientRoom(participantId);
  if (!room) return { room, participant: undefined };
  const participant = room.host.id === participantId ? room.host : room.viewers.get(participantId);
  return { room, participant };
}

/**
 * Validates room membership and returns the unchanged message plus its target.
 * The caller is responsible for sending the relay and never echoes it to the sender.
 */
export function handleWebRtcSignal(
  ws: WebSocket,
  message: WebRtcSignalMessage,
  roomManager: RoomManager,
): WebRtcRelay | ErrorMessage {
  const payload = asRecord(message.payload);
  if (!payload) {
    return createErrorMessage('INVALID_WEBRTC_PAYLOAD', 'WebRTC signaling requires a payload object');
  }

  const routingError = validateRouting(payload);
  if (routingError) return routingError;

  const roomCode = payload['roomCode'] as string;
  const participantId = payload['participantId'] as string;
  const targetId = payload['targetId'] as string;
  const sender = participantForId(roomManager, participantId);

  if (!sender.room || sender.room.code !== roomCode || sender.participant?.ws !== ws) {
    return createErrorMessage('PARTICIPANT_NOT_IN_ROOM', 'Sender does not belong to the specified room');
  }

  const target = participantForId(roomManager, targetId);
  if (!target.room || target.room !== sender.room || !target.participant) {
    return createErrorMessage('TARGET_NOT_IN_ROOM', 'Target participant does not belong to this room');
  }

  if (message.type === SignalingMessageType.WEBRTC_OFFER) {
    if (!isSessionDescription(payload['sdp'], 'offer')) {
      return createErrorMessage('INVALID_WEBRTC_PAYLOAD', 'A valid SDP offer is required');
    }
  } else if (message.type === SignalingMessageType.WEBRTC_ANSWER) {
    if (!isSessionDescription(payload['sdp'], 'answer')) {
      return createErrorMessage('INVALID_WEBRTC_PAYLOAD', 'A valid SDP answer is required');
    }
  } else if (!isIceCandidate(payload['candidate'])) {
    return createErrorMessage('INVALID_WEBRTC_PAYLOAD', 'A valid ICE candidate is required');
  }

  return { target: target.participant, message };
}
