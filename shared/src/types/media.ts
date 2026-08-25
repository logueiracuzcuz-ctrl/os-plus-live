/**
 * Media capture and streaming configuration types.
 */

/**
 * Configuration for screen capture.
 */
export interface ScreenCaptureConfig {
  /** Target frame rate for the captured stream */
  frameRate: number;
  /** Preferred video width */
  width: number;
  /** Preferred video height */
  height: number;
  /** Whether to capture system audio */
  captureAudio: boolean;
}

/**
 * WebRTC peer connection configuration.
 */
export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
}

/**
 * Default ICE servers for WebRTC connections.
 * Includes public STUN servers for NAT traversal.
 * TURN servers should be configured separately for production.
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Default screen capture configuration.
 */
export const DEFAULT_SCREEN_CAPTURE: ScreenCaptureConfig = {
  frameRate: 30,
  width: 1920,
  height: 1080,
  captureAudio: false,
};

/**
 * Default peer connection configuration.
 */
export const DEFAULT_PEER_CONNECTION_CONFIG: PeerConnectionConfig = {
  iceServers: DEFAULT_ICE_SERVERS,
  iceCandidatePoolSize: 2,
};
