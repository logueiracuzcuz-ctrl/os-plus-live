/**
 * Room state and configuration types.
 */

/**
 * Current state of a room.
 */
export enum RoomState {
  /** Room is waiting for the host to start sharing */
  WAITING = 'WAITING',
  /** Host is actively sharing their screen */
  SHARING = 'SHARING',
  /** Room has been closed */
  CLOSED = 'CLOSED',
}

/**
 * Complete room information.
 */
export interface RoomInfo {
  id: string;
  code: string;
  state: RoomState;
  hostId: string;
  hostDisplayName: string;
  viewerIds: string[];
  createdAt: number;
  lastActivityAt: number;
}

/**
 * Configuration for room creation.
 */
export interface RoomConfig {
  maxParticipants: number;
  idleTimeoutMs: number;
}
