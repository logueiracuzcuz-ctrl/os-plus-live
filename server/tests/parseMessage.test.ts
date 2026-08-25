import { SignalingMessageType, SERVER_CONFIG } from '@screenshare/shared';
import { createErrorMessage, parseIncomingMessage } from '../src/parseMessage';

describe('createErrorMessage', () => {
  it('should build an ERROR signaling message', () => {
    const error = createErrorMessage('INVALID_JSON', 'Message must be valid JSON');
    expect(error.type).toBe(SignalingMessageType.ERROR);
    expect(error.payload.code).toBe('INVALID_JSON');
    expect(error.payload.message).toBe('Message must be valid JSON');
  });
});

describe('parseIncomingMessage', () => {
  it('should accept a structurally valid CREATE_ROOM message', () => {
    const raw = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: 'Alice' },
    });

    const result = parseIncomingMessage(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.type).toBe(SignalingMessageType.CREATE_ROOM);
    }
  });

  it('should reject invalid JSON', () => {
    const result = parseIncomingMessage('{not-json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe(SignalingMessageType.ERROR);
      expect(result.error.payload.code).toBe('INVALID_JSON');
    }
  });

  it('should reject a message without a known type', () => {
    const result = parseIncomingMessage(JSON.stringify({ type: 'NOT_A_TYPE' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.payload.code).toBe('INVALID_MESSAGE');
    }
  });

  it('should reject a non-object JSON value', () => {
    const result = parseIncomingMessage('"hello"');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.payload.code).toBe('INVALID_MESSAGE');
    }
  });

  it('should reject messages that exceed the size limit', () => {
    const oversized = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: 'A'.repeat(200) },
    });

    const result = parseIncomingMessage(oversized, 32);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.payload.code).toBe('MESSAGE_TOO_LARGE');
    }
  });

  it('should use the default max size when none is provided', () => {
    const raw = JSON.stringify({ type: SignalingMessageType.LEAVE_ROOM });
    expect(raw.length).toBeLessThan(SERVER_CONFIG.MAX_MESSAGE_SIZE);

    const result = parseIncomingMessage(raw);
    expect(result.ok).toBe(true);
  });
});
