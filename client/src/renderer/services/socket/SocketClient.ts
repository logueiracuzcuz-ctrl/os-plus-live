/**
 * Socket client for WebSocket communication with the signaling server.
 * Handles connection, reconnection, message sending, and event emission.
 */

import {
  SignalingMessageType,
  type AnySignalingMessage,
  type CreateRoomMessage,
  type JoinRoomMessage,
  type LeaveRoomMessage,
  type ConnectedMessage,
  type RoomCreatedMessage,
  type RoomJoinedMessage,
  type ParticipantJoinedMessage,
  type ParticipantLeftMessage,
  type ParticipantSharingChangedMessage,
  type ErrorMessage,
  type WebRtcOfferMessage,
  type WebRtcAnswerMessage,
  type IceCandidateMessage,
} from '@screenshare/shared';
import type {
  SocketState,
  SocketClientConfig,
  SocketEvent,
  SocketEventListener,
  SocketEventType,
} from './types';

export class SocketClient {
  private ws: WebSocket | null = null;
  private state: SocketState = 'disconnected';
  private clientId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private listeners: Map<SocketEventType, Set<SocketEventListener>> = new Map();
  private messageQueue: AnySignalingMessage[] = [];
  private config: Required<SocketClientConfig>;

  constructor(config: SocketClientConfig) {
    this.config = {
      serverUrl: config.serverUrl,
      reconnectInterval: config.reconnectInterval ?? 1000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      connectionTimeout: config.connectionTimeout ?? 15000,
    };
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }

    this.shouldReconnect = true;
    this.setState('connecting');
    this.clearTimers();

    try {
      const ws = new WebSocket(this.config.serverUrl);
      this.ws = ws;
      this.setupWebSocketHandlers(ws);
      this.startConnectionTimeout();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    this.clientId = null;
  }

  /**
   * Send a message to the server.
   */
  send(message: AnySignalingMessage): boolean {
    const ws = this.ws;
    if (!ws || this.state !== 'connected' || ws.readyState !== WebSocket.OPEN) {
      // Queue message for when connection is established
      this.messageQueue.push(message);
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[SocketClient] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send a CREATE_ROOM message.
   */
  createRoom(displayName: string): boolean {
    const message: CreateRoomMessage = {
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName },
    };
    return this.send(message);
  }

  /**
   * Send a JOIN_ROOM message.
   */
  joinRoom(roomCode: string, displayName: string): boolean {
    const message: JoinRoomMessage = {
      type: SignalingMessageType.JOIN_ROOM,
      payload: { roomCode, displayName },
    };
    return this.send(message);
  }

  /**
   * Send a LEAVE_ROOM message.
   */
  leaveRoom(roomCode: string, participantId: string): boolean {
    const message: LeaveRoomMessage = {
      type: SignalingMessageType.LEAVE_ROOM,
      payload: { roomCode, participantId },
    };
    return this.send(message);
  }

  /** Broadcast the local participant's screen-sharing state. */
  sendSharingState(roomCode: string, participantId: string, isSharing: boolean): boolean {
    const message: ParticipantSharingChangedMessage = {
      type: SignalingMessageType.PARTICIPANT_SHARING_CHANGED,
      payload: { roomCode, participantId, isSharing },
    };
    return this.send(message);
  }

  /** Send a WebRTC SDP offer to another participant. */
  sendWebRtcOffer(
    roomCode: string,
    participantId: string,
    targetId: string,
    sdp: RTCSessionDescriptionInit,
  ): boolean {
    const message: WebRtcOfferMessage = {
      type: SignalingMessageType.WEBRTC_OFFER,
      payload: { roomCode, participantId, targetId, sdp },
    };
    console.log(`[WebRTC SIGNAL] OFFER sent from=${participantId} to=${targetId}`);
    return this.send(message);
  }

  /** Send a WebRTC SDP answer to another participant. */
  sendWebRtcAnswer(
    roomCode: string,
    participantId: string,
    targetId: string,
    sdp: RTCSessionDescriptionInit,
  ): boolean {
    const message: WebRtcAnswerMessage = {
      type: SignalingMessageType.WEBRTC_ANSWER,
      payload: { roomCode, participantId, targetId, sdp },
    };
    console.log(`[WebRTC SIGNAL] ANSWER sent from=${participantId} to=${targetId}`);
    return this.send(message);
  }

  /** Send an ICE candidate to another participant. */
  sendIceCandidate(
    roomCode: string,
    participantId: string,
    targetId: string,
    candidate: RTCIceCandidateInit,
  ): boolean {
    const message: IceCandidateMessage = {
      type: SignalingMessageType.ICE_CANDIDATE,
      payload: { roomCode, participantId, targetId, candidate },
    };
    console.log(`[WebRTC ICE] candidate sent from=${participantId} to=${targetId}`);
    return this.send(message);
  }

  /**
   * Register an event listener.
   */
  on(eventType: SocketEventType, listener: SocketEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove an event listener.
   */
  off(eventType: SocketEventType, listener: SocketEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /** Get current connection state. */
  getState(): SocketState {
    return this.state;
  }

  /** Return true only when the underlying WebSocket is actually open. */
  isReady(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Wait for the current connection to become usable without opening another socket.
   */
  waitUntilReady(timeout = this.config.connectionTimeout): Promise<boolean> {
    if (this.isReady()) return Promise.resolve(true);

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const interval = setInterval(() => {
        if (this.isReady()) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(true);
        } else if (Date.now() - startedAt >= timeout) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(false);
        }
      }, 50);
      const timer = setTimeout(() => {
        clearInterval(interval);
        resolve(false);
      }, timeout);
    });
  }

  /**
   * Get current client ID.
   */
  getClientId(): string | null {
    return this.clientId;
  }

  private setupWebSocketHandlers(ws: WebSocket): void {
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.clearTimers();
      this.reconnectAttempts = 0;
      this.setState('connected');
      this.flushMessageQueue();
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.handleDisconnect(ws, event.reason);
    };

    ws.onerror = (error) => {
      if (this.ws !== ws) return;
      console.error('[SocketClient] WebSocket error:', error);
      this.handleError(new Error('WebSocket connection error'));
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as AnySignalingMessage;

      this.emit('message', { type: 'message', payload: { type: 'message', message } });

      switch (message.type) {
        case SignalingMessageType.CONNECTED:
          this.handleConnected(message as ConnectedMessage);
          break;

        case SignalingMessageType.ROOM_CREATED:
          this.emit('roomCreated', { type: 'roomCreated', payload: { type: 'roomCreated', data: message as RoomCreatedMessage } });
          break;

        case SignalingMessageType.ROOM_JOINED:
          this.emit('roomJoined', { type: 'roomJoined', payload: { type: 'roomJoined', data: message as RoomJoinedMessage } });
          break;

        case SignalingMessageType.PARTICIPANT_JOINED:
          this.emit('participantJoined', { type: 'participantJoined', payload: { type: 'participantJoined', data: message as ParticipantJoinedMessage } });
          break;

        case SignalingMessageType.PARTICIPANT_LEFT:
          this.emit('participantLeft', { type: 'participantLeft', payload: { type: 'participantLeft', data: message as ParticipantLeftMessage } });
          break;

        case SignalingMessageType.PARTICIPANT_SHARING_CHANGED:
          this.emit('participantSharingChanged', {
            type: 'participantSharingChanged',
            payload: { type: 'participantSharingChanged', data: message as ParticipantSharingChangedMessage },
          });
          break;

        case SignalingMessageType.WEBRTC_OFFER:
          console.log(`[WebRTC SIGNAL] OFFER received local=${(message as WebRtcOfferMessage).payload.targetId} remote=${(message as WebRtcOfferMessage).payload.participantId}`);
          this.emit('webrtcOffer', { type: 'webrtcOffer', payload: { type: 'webrtcOffer', data: message as WebRtcOfferMessage } });
          break;

        case SignalingMessageType.WEBRTC_ANSWER:
          console.log(`[WebRTC SIGNAL] ANSWER received local=${(message as WebRtcAnswerMessage).payload.targetId} remote=${(message as WebRtcAnswerMessage).payload.participantId}`);
          this.emit('webrtcAnswer', { type: 'webrtcAnswer', payload: { type: 'webrtcAnswer', data: message as WebRtcAnswerMessage } });
          break;

        case SignalingMessageType.ICE_CANDIDATE:
          console.log(`[WebRTC ICE] candidate received local=${(message as IceCandidateMessage).payload.targetId} remote=${(message as IceCandidateMessage).payload.participantId}`);
          this.emit('iceCandidate', { type: 'iceCandidate', payload: { type: 'iceCandidate', data: message as IceCandidateMessage } });
          break;

        case SignalingMessageType.ERROR:
          this.emit('serverError', { type: 'serverError', payload: { type: 'serverError', data: message as ErrorMessage } });
          break;

        default:
          // WebRTC messages will be handled in later phase
          console.log('[SocketClient] Unhandled message type:', message.type);
          break;
      }
    } catch (error) {
      console.error('[SocketClient] Failed to parse message:', error);
      this.handleError(new Error('Failed to parse server message'));
    }
  }

  private handleConnected(message: ConnectedMessage): void {
    this.clientId = message.payload.clientId;
    this.emit('connected', { type: 'connected', payload: { type: 'connected', clientId: message.payload.clientId } });
  }

  private handleDisconnect(ws?: WebSocket, reason?: string): void {
    if (ws && this.ws !== ws) return;

    this.ws = null;
    this.clientId = null;
    this.setState('disconnected');
    this.emit('disconnected', { type: 'disconnected', payload: { type: 'disconnected', reason } });

    // Attempt reconnection if not manually disconnected
    if (this.shouldReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error): void {
    this.setState('error');
    this.emit('error', { type: 'error', payload: { type: 'error', error } });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    this.setState('reconnecting');
    console.log(`[SocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startConnectionTimeout(): void {
    this.connectionTimer = setTimeout(() => {
      if (this.state === 'connecting') {
        this.ws?.close();
        this.handleError(new Error('Connection timeout'));
      }
    }, this.config.connectionTimeout);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private setState(newState: SocketState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('stateChange', { type: 'stateChange', payload: { type: 'stateChange', state: newState } });
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private emit(eventType: SocketEventType, event: SocketEvent): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[SocketClient] Error in ${eventType} listener:`, error);
        }
      });
    }
  }
}
