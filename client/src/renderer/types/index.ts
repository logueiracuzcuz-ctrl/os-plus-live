/**
 * Core application types for the ScreenShare client.
 */

/** Available routes in the application. */
export type Route = 'home' | 'create-room' | 'join-room' | 'room' | 'viewer';

/** Connection status to the signaling server. */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

import type {
  SocketEventListener,
  SocketEventType,
  SocketState,
} from '../services/socket/types';

/** Public socket client contract used by renderer components. */
export interface ISocketClient {
  connect(): void;
  disconnect(): void;
  createRoom(displayName: string): boolean;
  joinRoom(roomCode: string, displayName: string): boolean;
  leaveRoom(roomCode: string, participantId: string): boolean;
  sendWebRtcOffer(roomCode: string, participantId: string, targetId: string, sdp: RTCSessionDescriptionInit): boolean;
  sendWebRtcAnswer(roomCode: string, participantId: string, targetId: string, sdp: RTCSessionDescriptionInit): boolean;
  sendIceCandidate(roomCode: string, participantId: string, targetId: string, candidate: RTCIceCandidateInit): boolean;
  on(eventType: SocketEventType, listener: SocketEventListener): void;
  off(eventType: SocketEventType, listener: SocketEventListener): void;
  getState(): SocketState;
  isReady(): boolean;
  waitUntilReady(timeout?: number): Promise<boolean>;
  getClientId(): string | null;
}

/** Participant in a room. */
export interface Participant {
  id: string;
  displayName: string;
  isHost: boolean;
  isSharing: boolean;
}

/** Room data held on the client. */
export interface RoomData {
  code: string;
  participantId: string;
  displayName: string;
  isHost: boolean;
  hostId: string;
  hostDisplayName: string;
  participants: Participant[];
}

/** Video quality options. */
export type VideoQuality = '720p' | '1080p';

/** Frame rate options. */
export type FrameRate = 30 | 60;

/** Audio source options. */
export type AudioSource = 'off' | 'microphone' | 'system' | 'both';

/** Transmission settings. */
export interface TransmissionSettings {
  quality: VideoQuality;
  frameRate: FrameRate;
  audio: AudioSource;
}

/** Toast notification type. */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/** Toast notification. */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

/** Modal definition. */
export interface ModalData {
  id: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'danger';
}

/** Full application state. */
export interface AppState {
  route: Route;
  connectionStatus: ConnectionStatus;
  room: RoomData | null;
  transmission: TransmissionSettings;
  toasts: Toast[];
  modal: ModalData | null;
}

/** Application actions. */
export type AppAction =
  | { type: 'NAVIGATE'; route: Route }
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus }
  | { type: 'SET_ROOM'; room: RoomData | null }
  | { type: 'UPDATE_PARTICIPANTS'; participants: Participant[] }
  | { type: 'SET_LOCAL_SHARING'; isSharing: boolean }
  | { type: 'UPDATE_TRANSMISSION'; settings: Partial<TransmissionSettings> }
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'SHOW_MODAL'; modal: ModalData }
  | { type: 'HIDE_MODAL' };

/** Default transmission settings. */
export const DEFAULT_TRANSMISSION: TransmissionSettings = {
  quality: '1080p',
  frameRate: 30,
  audio: 'off',
};

/** Initial application state. */
export const INITIAL_STATE: AppState = {
  route: 'home',
  connectionStatus: 'disconnected',
  room: null,
  transmission: DEFAULT_TRANSMISSION,
  toasts: [],
  modal: null,
};
