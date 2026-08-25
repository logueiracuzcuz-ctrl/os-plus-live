import { SignalingMessageType, ROOM_CONFIG } from '@screenshare/shared';
import { handleCreateRoom } from '../src/handleCreateRoom';
import { handleIncomingFrame } from '../src/handleIncomingFrame';
import { RoomManager, type ClientConnection } from '../src/RoomManager';

function createMockWs(): ClientConnection['ws'] {
  return {
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
  } as unknown as ClientConnection['ws'];
}

describe('CREATE_ROOM flow', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it('should create a room and return ROOM_CREATED for a valid CREATE_ROOM', () => {
    const ws = createMockWs();
    const raw = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: 'Alice' },
    });

    const response = handleIncomingFrame(ws, raw, roomManager);

    expect(response).not.toBeNull();
    expect(response?.type).toBe(SignalingMessageType.ROOM_CREATED);
    if (response?.type === SignalingMessageType.ROOM_CREATED) {
      expect(response.payload.roomCode).toHaveLength(ROOM_CONFIG.ROOM_CODE_LENGTH);
      expect(typeof response.payload.participantId).toBe('string');
      expect(response.payload.participantId.length).toBeGreaterThan(0);
    }
  });

  it('should reject invalid CREATE_ROOM payload', () => {
    const ws = createMockWs();
    const raw = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
    });

    const response = handleIncomingFrame(ws, raw, roomManager);

    expect(response?.type).toBe(SignalingMessageType.ERROR);
    if (response?.type === SignalingMessageType.ERROR) {
      expect(response.payload.code).toBe('INVALID_PAYLOAD');
      expect(response.payload.message).toBeTruthy();
      expect(response.payload.message).not.toMatch(/at\s+\w+\s+\(/);
    }
    expect(roomManager.activeRoomCount).toBe(0);
  });

  it('should actually create the room in RoomManager', () => {
    const ws = createMockWs();
    const raw = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: 'Host' },
    });

    const response = handleIncomingFrame(ws, raw, roomManager);

    expect(roomManager.activeRoomCount).toBe(1);
    expect(response?.type).toBe(SignalingMessageType.ROOM_CREATED);
    if (response?.type === SignalingMessageType.ROOM_CREATED) {
      const room = roomManager.getRoomByCode(response.payload.roomCode);
      expect(room).toBeDefined();
      expect(room?.code).toBe(response.payload.roomCode);
    }
  });

  it('should register the client as host', () => {
    const ws = createMockWs();
    const raw = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: '  HostName  ' },
    });

    const response = handleIncomingFrame(ws, raw, roomManager);

    expect(response?.type).toBe(SignalingMessageType.ROOM_CREATED);
    if (response?.type === SignalingMessageType.ROOM_CREATED) {
      const room = roomManager.getRoomByCode(response.payload.roomCode);
      expect(room?.host.id).toBe(response.payload.participantId);
      expect(room?.host.isHost).toBe(true);
      expect(room?.host.displayName).toBe('HostName');
      expect(room?.host.ws).toBe(ws);
      expect(roomManager.getClientRoom(response.payload.participantId)).toBe(room);
    }
  });

  it('should return ROOM_CREATED with roomCode and participantId', () => {
    const ws = createMockWs();
    const message = {
      type: SignalingMessageType.CREATE_ROOM as const,
      payload: { displayName: 'Bob' },
    };

    const response = handleCreateRoom(ws, message, roomManager);

    expect(response.type).toBe(SignalingMessageType.ROOM_CREATED);
    if (response.type === SignalingMessageType.ROOM_CREATED) {
      expect(Object.keys(response.payload).sort()).toEqual(['participantId', 'roomCode']);
      expect(roomManager.getRoomByCode(response.payload.roomCode)?.host.id).toBe(
        response.payload.participantId,
      );
    }
  });

  it('should return ERROR for invalid display name', () => {
    const ws = createMockWs();
    const raw = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: '   ' },
    });

    const response = handleIncomingFrame(ws, raw, roomManager);

    expect(response?.type).toBe(SignalingMessageType.ERROR);
    if (response?.type === SignalingMessageType.ERROR) {
      expect(response.payload.code).toBe('INVALID_DISPLAY_NAME');
      expect(response.payload).not.toHaveProperty('stack');
    }
    expect(roomManager.activeRoomCount).toBe(0);
  });

  it('should return ERROR for invalid participant limit when provided', () => {
    const ws = createMockWs();
    const raw = JSON.stringify({
      type: SignalingMessageType.CREATE_ROOM,
      payload: { displayName: 'Alice', maxParticipants: 0 },
    });

    const response = handleIncomingFrame(ws, raw, roomManager);

    expect(response?.type).toBe(SignalingMessageType.ERROR);
    if (response?.type === SignalingMessageType.ERROR) {
      expect(response.payload.code).toBe('INVALID_MAX_PARTICIPANTS');
    }
    expect(roomManager.activeRoomCount).toBe(0);
  });

  it('should create more than one room independently', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    const first = handleIncomingFrame(
      ws1,
      JSON.stringify({
        type: SignalingMessageType.CREATE_ROOM,
        payload: { displayName: 'Alice' },
      }),
      roomManager,
    );
    const second = handleIncomingFrame(
      ws2,
      JSON.stringify({
        type: SignalingMessageType.CREATE_ROOM,
        payload: { displayName: 'Bob' },
      }),
      roomManager,
    );

    expect(first?.type).toBe(SignalingMessageType.ROOM_CREATED);
    expect(second?.type).toBe(SignalingMessageType.ROOM_CREATED);
    expect(roomManager.activeRoomCount).toBe(2);
    expect(roomManager.totalClientCount).toBe(2);

    if (
      first?.type === SignalingMessageType.ROOM_CREATED &&
      second?.type === SignalingMessageType.ROOM_CREATED
    ) {
      expect(first.payload.roomCode).not.toBe(second.payload.roomCode);
      expect(first.payload.participantId).not.toBe(second.payload.participantId);
      expect(roomManager.getRoomByCode(first.payload.roomCode)?.host.displayName).toBe('Alice');
      expect(roomManager.getRoomByCode(second.payload.roomCode)?.host.displayName).toBe('Bob');
    }
  });

  it('should return ERROR without a stack trace when room creation fails internally', () => {
    const ws = createMockWs();
    jest.spyOn(roomManager, 'generateUniqueCode').mockImplementation(() => {
      throw new Error('Failed to generate unique room code after maximum attempts');
    });

    const response = handleIncomingFrame(
      ws,
      JSON.stringify({
        type: SignalingMessageType.CREATE_ROOM,
        payload: { displayName: 'Alice' },
      }),
      roomManager,
    );

    expect(response?.type).toBe(SignalingMessageType.ERROR);
    if (response?.type === SignalingMessageType.ERROR) {
      expect(response.payload.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(response)).not.toContain('maximum attempts');
      expect(response.payload.message).toBe('Failed to create room');
    }
    expect(roomManager.activeRoomCount).toBe(0);
  });

  it('returns ROOM_NOT_FOUND when JOIN_ROOM references an unknown room', () => {
    const ws = createMockWs();
    const response = handleIncomingFrame(
      ws,
      JSON.stringify({
        type: SignalingMessageType.JOIN_ROOM,
        payload: { roomCode: 'ABC234', displayName: 'Viewer' },
      }),
      roomManager,
    );

    expect(response?.type).toBe(SignalingMessageType.ERROR);
    if (response?.type === SignalingMessageType.ERROR) {
      expect(response.payload.code).toBe('ROOM_NOT_FOUND');
    }
    expect(roomManager.activeRoomCount).toBe(0);
  });
});
