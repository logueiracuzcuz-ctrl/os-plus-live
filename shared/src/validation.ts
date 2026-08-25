/**
 * Input validation utilities for signaling messages and user inputs.
 * All validation functions return a result object with success/error details.
 */

import { ROOM_CONFIG } from './constants.js';
import { SignalingMessageType } from './types/signaling.js';

/**
 * Validation result type.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Successful validation result. */
const VALID: ValidationResult = { valid: true };

/**
 * Creates a failed validation result.
 */
function invalid(error: string): ValidationResult {
  return { valid: false, error };
}

/**
 * Validates that a display name meets requirements.
 */
export function validateDisplayName(name: unknown): ValidationResult {
  if (typeof name !== 'string') {
    return invalid('Display name must be a string');
  }

  const trimmed = name.trim();

  if (trimmed.length < ROOM_CONFIG.MIN_DISPLAY_NAME_LENGTH) {
    return invalid('Display name cannot be empty');
  }

  if (trimmed.length > ROOM_CONFIG.MAX_DISPLAY_NAME_LENGTH) {
    return invalid(`Display name cannot exceed ${ROOM_CONFIG.MAX_DISPLAY_NAME_LENGTH} characters`);
  }

  return VALID;
}

/**
 * Validates that a room code has the correct format.
 */
export function validateRoomCode(code: unknown): ValidationResult {
  if (typeof code !== 'string') {
    return invalid('Room code must be a string');
  }

  if (code.length !== ROOM_CONFIG.ROOM_CODE_LENGTH) {
    return invalid(`Room code must be ${ROOM_CONFIG.ROOM_CODE_LENGTH} characters`);
  }

  const validChars = new Set(ROOM_CONFIG.ROOM_CODE_CHARS.split(''));
  for (const char of code) {
    if (!validChars.has(char)) {
      return invalid('Room code contains invalid characters');
    }
  }

  return VALID;
}

/** Valid signaling message types as a set for fast lookup. */
const VALID_MESSAGE_TYPES = new Set<string>(Object.values(SignalingMessageType));

/**
 * Validates that a parsed JSON object is a structurally valid signaling message.
 */
export function validateSignalingMessage(data: unknown): ValidationResult {
  if (typeof data !== 'object' || data === null) {
    return invalid('Message must be a non-null object');
  }

  const msg = data as Record<string, unknown>;

  if (typeof msg['type'] !== 'string') {
    return invalid('Message must have a string "type" field');
  }

  if (!VALID_MESSAGE_TYPES.has(msg['type'])) {
    return invalid(`Unknown message type: ${String(msg['type'])}`);
  }

  return VALID;
}

/**
 * Validates that a string does not exceed the maximum message size.
 */
export function validateMessageSize(data: string, maxSize: number): ValidationResult {
  const encoder = new TextEncoder();
  const byteSize = encoder.encode(data).length;

  if (byteSize > maxSize) {
    return invalid(`Message size (${byteSize} bytes) exceeds maximum (${maxSize} bytes)`);
  }

  return VALID;
}
