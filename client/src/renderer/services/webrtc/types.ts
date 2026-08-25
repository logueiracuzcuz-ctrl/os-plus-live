/** Types for RTCPeerConnection lifecycle and diagnostics. */

export type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export type IceConnectionState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'disconnected'
  | 'failed'
  | 'closed';

export type IceGatheringState = 'new' | 'gathering' | 'complete';

export type WebRtcManagerEvent =
  | { type: 'peerCreated'; participantId: string }
  | { type: 'peerClosed'; participantId: string }
  | { type: 'remoteStream'; participantId: string; stream: MediaStream }
  | { type: 'remoteStreamRemoved'; participantId: string }
  | { type: 'connectionStateChanged'; participantId: string; state: PeerConnectionState }
  | { type: 'iceConnectionStateChanged'; participantId: string; state: IceConnectionState }
  | { type: 'iceGatheringStateChanged'; participantId: string; state: IceGatheringState }
  | { type: 'error'; participantId: string; error: Error };

export type WebRtcManagerListener = (event: WebRtcManagerEvent) => void;

/** Lightweight outbound/inbound metrics collected on demand from a peer. */
export interface WebRtcPeerStats {
  participantId: string;
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  framesEncoded: number;
  framesDecoded: number;
  framesDropped: number;
  framesPerSecond?: number;
  jitter?: number;
  roundTripTime?: number;
}

export interface WebRtcManagerConfig {
  rtcConfiguration?: RTCConfiguration;
  peerConnectionFactory?: (configuration?: RTCConfiguration) => RTCPeerConnection;
  onEvent?: (event: WebRtcManagerEvent) => void;
}
