/**
 * Parse and validate inbound WebSocket signaling payloads.
 * Does not dispatch room or WebRTC actions — that comes in later Phase 2 steps.
 */

import {
  SERVER_CONFIG,
  SignalingMessageType,
  validateMessageSize,
  validateSignalingMessage,
  type AnySignalingMessage,
  type ErrorMessage,
} from '@screenshare/shared';

export type ParseIncomingResult =
  | { ok: true; message: AnySignalingMessage }
  | { ok: false; error: ErrorMessage };

/** Builds a protocol ERROR message. */
export function createErrorMessage(code: string, message: string): ErrorMessage {
  return {
    type: SignalingMessageType.ERROR,
    payload: { code, message },
  };
}

/**
 * Converts a raw WebSocket frame into a validated signaling message,
 * or an ERROR payload describing why it was rejected.
 */
export function parseIncomingMessage(
  raw: string,
  maxSize: number = SERVER_CONFIG.MAX_MESSAGE_SIZE,
): ParseIncomingResult {
  const sizeResult = validateMessageSize(raw, maxSize);
  if (!sizeResult.valid) {
    return {
      ok: false,
      error: createErrorMessage('MESSAGE_TOO_LARGE', sizeResult.error ?? 'Message exceeds maximum size'),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {
      ok: false,
      error: createErrorMessage('INVALID_JSON', 'Message must be valid JSON'),
    };
  }

  const structureResult = validateSignalingMessage(parsed);
  if (!structureResult.valid) {
    return {
      ok: false,
      error: createErrorMessage('INVALID_MESSAGE', structureResult.error ?? 'Invalid signaling message'),
    };
  }

  return { ok: true, message: parsed as AnySignalingMessage };
}