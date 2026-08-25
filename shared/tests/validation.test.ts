import {
  validateDisplayName,
  validateRoomCode,
  validateSignalingMessage,
  validateMessageSize,
} from '../src/validation';
import { SignalingMessageType } from '../src/types/signaling';
import { ROOM_CONFIG } from '../src/constants';

describe('validateDisplayName', () => {
  it('should accept a valid display name', () => {
    const result = validateDisplayName('Alice');
    expect(result.valid).toBe(true);
  });

  it('should accept a single character name', () => {
    const result = validateDisplayName('A');
    expect(result.valid).toBe(true);
  });

  it('should trim whitespace before validation', () => {
    const result = validateDisplayName('  Alice  ');
    expect(result.valid).toBe(true);
  });

  it('should reject empty string', () => {
    const result = validateDisplayName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject whitespace-only string', () => {
    const result = validateDisplayName('   ');
    expect(result.valid).toBe(false);
  });

  it('should reject non-string input', () => {
    expect(validateDisplayName(123).valid).toBe(false);
    expect(validateDisplayName(null).valid).toBe(false);
    expect(validateDisplayName(undefined).valid).toBe(false);
    expect(validateDisplayName({}).valid).toBe(false);
  });

  it('should reject names exceeding max length', () => {
    const longName = 'A'.repeat(ROOM_CONFIG.MAX_DISPLAY_NAME_LENGTH + 1);
    const result = validateDisplayName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceed');
  });

  it('should accept names at exactly max length', () => {
    const name = 'A'.repeat(ROOM_CONFIG.MAX_DISPLAY_NAME_LENGTH);
    const result = validateDisplayName(name);
    expect(result.valid).toBe(true);
  });
});

describe('validateRoomCode', () => {
  it('should accept a valid room code', () => {
    const result = validateRoomCode('ABC234');
    expect(result.valid).toBe(true);
  });

  it('should reject non-string input', () => {
    expect(validateRoomCode(123456).valid).toBe(false);
    expect(validateRoomCode(null).valid).toBe(false);
  });

  it('should reject wrong length', () => {
    expect(validateRoomCode('ABC').valid).toBe(false);
    expect(validateRoomCode('ABCDEFGHIJ').valid).toBe(false);
  });

  it('should reject invalid characters', () => {
    // '0', '1', 'I', 'O' are excluded from ROOM_CODE_CHARS
    expect(validateRoomCode('000000').valid).toBe(false);
    expect(validateRoomCode('111111').valid).toBe(false);
    expect(validateRoomCode('IIIIII').valid).toBe(false);
    expect(validateRoomCode('OOOOOO').valid).toBe(false);
  });

  it('should reject lowercase characters', () => {
    expect(validateRoomCode('abcdef').valid).toBe(false);
  });
});

describe('validateSignalingMessage', () => {
  it('should accept a valid message', () => {
    const result = validateSignalingMessage({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: 'Alice' },
    });
    expect(result.valid).toBe(true);
  });

  it('should reject null or non-object', () => {
    expect(validateSignalingMessage(null).valid).toBe(false);
    expect(validateSignalingMessage('string').valid).toBe(false);
    expect(validateSignalingMessage(42).valid).toBe(false);
  });

  it('should reject message without type', () => {
    expect(validateSignalingMessage({ payload: {} }).valid).toBe(false);
  });

  it('should reject message with non-string type', () => {
    expect(validateSignalingMessage({ type: 42 }).valid).toBe(false);
  });

  it('should reject unknown message type', () => {
    expect(validateSignalingMessage({ type: 'UNKNOWN_TYPE' }).valid).toBe(false);
  });

  it('should accept all known message types', () => {
    for (const type of Object.values(SignalingMessageType)) {
      const result = validateSignalingMessage({ type });
      expect(result.valid).toBe(true);
    }
  });
});

describe('validateMessageSize', () => {
  it('should accept messages within size limit', () => {
    const result = validateMessageSize('hello', 1000);
    expect(result.valid).toBe(true);
  });

  it('should reject messages exceeding size limit', () => {
    const bigMessage = 'A'.repeat(2000);
    const result = validateMessageSize(bigMessage, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });

  it('should accept empty string', () => {
    const result = validateMessageSize('', 1000);
    expect(result.valid).toBe(true);
  });
});
