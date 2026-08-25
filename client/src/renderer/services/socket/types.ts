/** Types used by the renderer WebSocket client. */

import type {
  AnySignalingMessage,
  ErrorMessage,
  ParticipantJoinedMessage,
  ParticipantLeftMessage,
  RoomCreatedMessage,
  RoomJoinedMessage,
  WebRtcAnswerMessage,
  WebRtcOfferMessage,
  IceCandidateMessage,
} from '@screenshare/shared';

export type SocketState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type SocketEventType =
  | 'stateChange'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'roomCreated'
  | 'roomJoined'
  | 'participantJoined'
  | 'participantLeft'
  | 'serverError'
  | 'webrtcOffer'
  | 'webrtcAnswer'
  | 'iceCandidate';

export interface SocketEventPayloadMap {
  stateChange: { type: 'stateChange'; state: SocketState };
  connected: { type: 'connected'; clientId: string };
  disconnected: { type: 'disconnected'; reason?: string };
  error: { type: 'error'; error: Error };
  message: { type: 'message'; message: AnySignalingMessage };
  roomCreated: { type: 'roomCreated'; data: RoomCreatedMessage };
  roomJoined: { type: 'roomJoined'; data: RoomJoinedMessage };
  participantJoined: { type: 'participantJoined'; data: ParticipantJoinedMessage };
  participantLeft: { type: 'participantLeft'; data: ParticipantLeftMessage };
  serverError: { type: 'serverError'; data: ErrorMessage };
  webrtcOffer: { type: 'webrtcOffer'; data: WebRtcOfferMessage };
  webrtcAnswer: { type: 'webrtcAnswer'; data: WebRtcAnswerMessage };
  iceCandidate: { type: 'iceCandidate'; data: IceCandidateMessage };
}

export type SocketEventPayload = SocketEventPayloadMap[SocketEventType];

export type SocketEvent = {
  [K in SocketEventType]: { type: K; payload: SocketEventPayloadMap[K] };
}[SocketEventType];

export type SocketEventListener = (event: SocketEvent) => void;

export interface SocketClientConfig {
  serverUrl: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  connectionTimeout?: number;
}
