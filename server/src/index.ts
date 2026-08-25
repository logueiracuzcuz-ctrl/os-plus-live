/**
 * ScreenShare Signaling Server
 *
 * WebSocket-based signaling server for WebRTC peer connection negotiation.
 * Handles room creation, participant management, and signaling message relay.
 */

import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import {
  SERVER_CONFIG,
  APP_VERSION,
  SignalingMessageType,
  type SignalingMessage,
  type ConnectedMessage,
  type ParticipantLeftMessage,
} from '@screenshare/shared';

import { RoomManager, type Room } from './RoomManager.js';
import { handleIncomingFrame } from './handleIncomingFrame.js';


function sendJson(ws: WebSocket, message: SignalingMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}


function broadcastToRoom(
  room: Room,
  message: SignalingMessage,
  excludeWs?: WebSocket,
): void {
  const participants = room.getActiveClients();

  for (const participant of participants) {
    if (excludeWs && participant.ws === excludeWs) {
      continue;
    }

    sendJson(participant.ws, message);
  }
}


const PORT = Number(process.env['PORT']) || SERVER_CONFIG.DEFAULT_PORT;
const HOST = process.env['HOST'] || SERVER_CONFIG.DEFAULT_HOST;


const _roomManager = new RoomManager();

const _clientConnections = new Map<WebSocket, string>();

const _participantConnections = new Map<WebSocket, string>();


/**
 * HTTP server.
 *
 * This allows Railway to access the service using normal HTTP requests.
 * The WebSocket server is attached to this same HTTP server.
 */
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      status: 'online',
      service: 'ScreenShare Signaling Server',
      version: APP_VERSION,
    }),
  );
});


/**
 * WebSocket server attached to the HTTP server.
 */
const wss = new WebSocketServer({
  server,
  maxPayload: SERVER_CONFIG.MAX_MESSAGE_SIZE,
});


/**
 * Start HTTP + WebSocket server.
 */
server.listen(PORT, HOST, () => {
  console.log(`[ScreenShare] Signaling server v${APP_VERSION}`);
  console.log(`[ScreenShare] Listening on port ${PORT}`);
  console.log(
    `[ScreenShare] Max message size: ${SERVER_CONFIG.MAX_MESSAGE_SIZE} bytes`,
  );
});


/**
 * Handle WebSocket connections.
 */
wss.on('connection', (ws, req) => {
  const remoteAddress = req.socket.remoteAddress ?? 'unknown';

  console.log(
    `[ScreenShare] New connection from ${remoteAddress}`,
  );


  // Generate client ID and send CONNECTED message
  const clientId = uuidv4();

  _clientConnections.set(ws, clientId);


  const connectedMessage: ConnectedMessage = {
    type: SignalingMessageType.CONNECTED,
    payload: {
      clientId,
    },
  };


  sendJson(ws, connectedMessage);


  /**
   * Handle incoming messages.
   */
  ws.on('message', (data) => {
    const messageStr = String(data);


    const response = handleIncomingFrame(
      ws,
      messageStr,
      _roomManager,

      (room, message, excludeWs) => {
        broadcastToRoom(
          room,
          message,
          excludeWs,
        );
      },

      (targetWs, message) => {
        sendJson(
          targetWs,
          message,
        );
      },
    );


    if (response) {
      if (
        response.type === SignalingMessageType.ROOM_CREATED ||
        response.type === SignalingMessageType.ROOM_JOINED
      ) {
        _participantConnections.set(
          ws,
          response.payload.participantId,
        );
      } else if (
        response.type === SignalingMessageType.PARTICIPANT_LEFT
      ) {
        _participantConnections.delete(ws);
      }


      sendJson(ws, response);

      return;
    }
  });


  /**
   * Handle client disconnect.
   */
  ws.on('close', () => {
    console.log(
      `[ScreenShare] Connection closed from ${remoteAddress}`,
    );


    const participantId =
      _participantConnections.get(ws);


    if (participantId) {
      // Capture the room and participant before removing mappings.
      const room =
        _roomManager.getClientRoom(participantId);


      if (room) {
        const participant =
          room.host.id === participantId
            ? room.host
            : room.viewers.get(participantId);


        if (participant) {
          _roomManager.removeClient(
            participantId,
          );


          const participantLeftMessage: ParticipantLeftMessage = {
            type: SignalingMessageType.PARTICIPANT_LEFT,
            payload: {
              participantId: participant.id,
              displayName: participant.displayName,
            },
          };


          broadcastToRoom(
            room,
            participantLeftMessage,
            ws,
          );
        }
      }


      _participantConnections.delete(ws);
    }


    _clientConnections.delete(ws);
  });


  /**
   * Handle WebSocket errors.
   */
  ws.on('error', (error) => {
    console.error(
      `[ScreenShare] WebSocket error from ${remoteAddress}:`,
      error.message,
    );
  });
});


/**
 * Handle WebSocket server errors.
 */
wss.on('error', (error) => {
  console.error(
    '[ScreenShare] Server error:',
    error.message,
  );

  process.exit(1);
});


/**
 * Graceful shutdown.
 */
function shutdown(): void {
  console.log(
    '\n[ScreenShare] Shutting down...',
  );


  wss.close(() => {
    server.close(() => {
      console.log(
        '[ScreenShare] Server closed',
      );

      process.exit(0);
    });
  });
}


process.on('SIGINT', shutdown);

process.on('SIGTERM', shutdown);