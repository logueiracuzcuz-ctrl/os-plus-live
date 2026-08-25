/**
 * Routes a raw WebSocket frame through parse + message handling.
 */

import type { WebSocket } from 'ws';
import { SignalingMessageType, type AnySignalingMessage, type SignalingMessage } from '@screenshare/shared';
import { parseIncomingMessage } from './parseMessage.js';
import { handleCreateRoom } from './handleCreateRoom.js';
import { handleJoinRoom } from './handleJoinRoom.js';
import { handleLeaveRoom } from './handleLeaveRoom.js';
import { handleWebRtcSignal, type WebRtcSignalMessage } from './handleWebRtcSignal.js';
import type { Room, RoomManager } from './RoomManager.js';

type BroadcastCallback = (room: Room, message: SignalingMessage, excludeWs?: WebSocket) => void;
type DirectMessageCallback = (ws: WebSocket, message: SignalingMessage) => void;



/**
 * Parses a raw frame and handles all signaling message types.
 * Returns a message to send to the client, or null when no response is needed.
 */
export function handleIncomingFrame(
  ws: WebSocket,
  raw: string,
  roomManager: RoomManager,
  broadcast?: BroadcastCallback,
  sendDirect?: DirectMessageCallback,
): AnySignalingMessage | null {
  const parsed = parseIncomingMessage(raw);
  if (!parsed.ok) {
    return parsed.error;
  }

  const message = parsed.message;

  switch (message.type) {
    case SignalingMessageType.CREATE_ROOM:
      return handleCreateRoom(ws, message, roomManager);

    case SignalingMessageType.JOIN_ROOM: {
      const result = handleJoinRoom(ws, message, roomManager);
      if ('response' in result) {
        if (result.broadcast && broadcast) {
          const room = roomManager.getRoomByCode(result.response.payload.roomCode);
          if (room) {
            broadcast(room, result.broadcast, ws);
          }
        }
        return result.response;
      }
      return result;
    }

    case SignalingMessageType.WEBRTC_OFFER:
    case SignalingMessageType.WEBRTC_ANSWER:
    case SignalingMessageType.ICE_CANDIDATE: {
      const result = handleWebRtcSignal(ws, message as WebRtcSignalMessage, roomManager);
      if ('target' in result) {
        sendDirect?.(result.target.ws, result.message);
        return null;
      }
      return result;
    }

    case SignalingMessageType.LEAVE_ROOM: {
      // Capture the room before the handler removes the participant mapping.
      const room = roomManager.getClientRoom(message.payload.participantId);
      const result = handleLeaveRoom(ws, message, roomManager);
      if (result && result.type === SignalingMessageType.PARTICIPANT_LEFT && room && broadcast) {
        broadcast(room, result, ws);
      }
      return result;
    }

    default:
      // WebRTC signaling (OFFER, ANSWER, ICE_CANDIDATE) will be handled in later phase
      return null;
  }
}
