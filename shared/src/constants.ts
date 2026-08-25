/**
 * Application-wide constants and configuration values.
 */

/** Current application version */
export const APP_VERSION = '0.1.0';

/** Server configuration defaults */
export const SERVER_CONFIG = {
  /** Default WebSocket port */
  DEFAULT_PORT: 3847,
  /** Default host binding */
  DEFAULT_HOST: '0.0.0.0',
  /** Maximum WebSocket message size in bytes (64 KB) */
  MAX_MESSAGE_SIZE: 65536,
  /** WebSocket ping interval in milliseconds */
  PING_INTERVAL_MS: 30_000,
  /** WebSocket pong timeout in milliseconds */
  PONG_TIMEOUT_MS: 10_000,
} as const;

/** Room configuration defaults */
export const ROOM_CONFIG = {
  /** Maximum number of viewers per room */
  MAX_PARTICIPANTS: 20,
  /** Room code length (characters) */
  ROOM_CODE_LENGTH: 6,
  /** Characters used for room code generation (uppercase alphanumeric, no ambiguous chars) */
  ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  /** Idle timeout before room auto-closes (milliseconds) */
  IDLE_TIMEOUT_MS: 5 * 60 * 1000,
  /** Minimum display name length */
  MIN_DISPLAY_NAME_LENGTH: 1,
  /** Maximum display name length */
  MAX_DISPLAY_NAME_LENGTH: 30,
} as const;

/** Rate limiting configuration */
export const RATE_LIMIT_CONFIG = {
  /** Maximum messages per window */
  MAX_MESSAGES_PER_WINDOW: 30,
  /** Rate limit window size in milliseconds */
  WINDOW_MS: 10_000,
} as const;

/** Client configuration defaults */
export const CLIENT_CONFIG = {
  /** Default signaling server URL */
  DEFAULT_SERVER_URL: 'ws://localhost:3847',
  /** Reconnection base delay in milliseconds */
  RECONNECT_BASE_DELAY_MS: 1_000,
  /** Maximum reconnection delay in milliseconds */
  RECONNECT_MAX_DELAY_MS: 30_000,
  /** Maximum reconnection attempts */
  MAX_RECONNECT_ATTEMPTS: 10,
  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT_MS: 15_000,
} as const;
