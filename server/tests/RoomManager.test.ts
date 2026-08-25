import { RoomManager, Room, ClientConnection } from '../src/RoomManager';
import { RoomState, ROOM_CONFIG } from '@screenshare/shared';

// Mock WebSocket for testing
function createMockWs(): ClientConnection['ws'] {
  return {
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
  } as unknown as ClientConnection['ws'];
}

function createMockClient(overrides?: Partial<ClientConnection>): ClientConnection {
  return {
    id: `client-${Math.random().toString(36).slice(2, 8)}`,
    displayName: 'TestUser',
    ws: createMockWs(),
    isHost: false,
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it('should start with zero rooms', () => {
    expect(roomManager.activeRoomCount).toBe(0);
    expect(roomManager.totalClientCount).toBe(0);
  });

  it('should create a room and track it', () => {
    const host = createMockClient({ isHost: true });
    const room = roomManager.createRoom(host, 'ABC234');

    expect(room).toBeInstanceOf(Room);
    expect(room.code).toBe('ABC234');
    expect(room.host.id).toBe(host.id);
    expect(roomManager.activeRoomCount).toBe(1);
    expect(roomManager.totalClientCount).toBe(1);
  });

  it('should find room by code', () => {
    const host = createMockClient({ isHost: true });
    const room = roomManager.createRoom(host, 'XYZ789');

    const found = roomManager.getRoomByCode('XYZ789');
    expect(found).toBe(room);
  });

  it('should find room by id', () => {
    const host = createMockClient({ isHost: true });
    const room = roomManager.createRoom(host, 'ABC234');

    const found = roomManager.getRoomById(room.id);
    expect(found).toBe(room);
  });

  it('should find client room', () => {
    const host = createMockClient({ isHost: true });
    const room = roomManager.createRoom(host, 'ABC234');

    const clientRoom = roomManager.getClientRoom(host.id);
    expect(clientRoom).toBe(room);
  });

  it('should remove a room', () => {
    const host = createMockClient({ isHost: true });
    roomManager.createRoom(host, 'ABC234');

    roomManager.removeRoom('ABC234');

    expect(roomManager.activeRoomCount).toBe(0);
    expect(roomManager.getRoomByCode('ABC234')).toBeUndefined();
  });

  it('should remove client and keep room if viewers remain', () => {
    const host = createMockClient({ isHost: true, displayName: 'Host' });
    const room = roomManager.createRoom(host, 'ABC234');

    const viewer = createMockClient({ displayName: 'Viewer' });
    room.addViewer(viewer);
    roomManager.addClientToRoom(viewer.id, room);

    // Remove viewer
    const removedRoom = roomManager.removeClient(viewer.id);
    expect(removedRoom).toBe(room);
    expect(roomManager.activeRoomCount).toBe(1);
    expect(room.viewers.size).toBe(0);
  });

  it('should remove room when host leaves and no viewers', () => {
    const host = createMockClient({ isHost: true });
    roomManager.createRoom(host, 'ABC234');

    roomManager.removeClient(host.id);

    expect(roomManager.activeRoomCount).toBe(0);
  });

  it('should generate unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(roomManager.generateUniqueCode());
    }
    expect(codes.size).toBe(50);
  });
});

describe('Room', () => {
  it('should start in WAITING state', () => {
    const host = createMockClient({ isHost: true });
    const room = new Room(host, 'ABC234');

    expect(room.state).toBe(RoomState.WAITING);
    expect(room.viewers.size).toBe(0);
    expect(room.participantCount).toBe(1);
  });

  it('should add viewers up to the limit', () => {
    const host = createMockClient({ isHost: true });
    const room = new Room(host, 'ABC234');

    for (let i = 0; i < ROOM_CONFIG.MAX_PARTICIPANTS; i++) {
      const viewer = createMockClient();
      const added = room.addViewer(viewer);
      expect(added).toBe(true);
    }

    // Next viewer should be rejected
    const extraViewer = createMockClient();
    const added = room.addViewer(extraViewer);
    expect(added).toBe(false);
    expect(room.viewers.size).toBe(ROOM_CONFIG.MAX_PARTICIPANTS);
  });

  it('should close room when host is removed', () => {
    const host = createMockClient({ isHost: true });
    const room = new Room(host, 'ABC234');

    room.removeClient(host.id);
    expect(room.state).toBe(RoomState.CLOSED);
    expect(room.isEmpty()).toBe(true);
  });

  it('should not close when a viewer is removed', () => {
    const host = createMockClient({ isHost: true });
    const room = new Room(host, 'ABC234');

    const viewer = createMockClient();
    room.addViewer(viewer);

    room.removeClient(viewer.id);
    expect(room.state).toBe(RoomState.WAITING);
    expect(room.viewers.size).toBe(0);
  });

  it('should return correct participant info', () => {
    const host = createMockClient({ isHost: true, displayName: 'Host' });
    const room = new Room(host, 'ABC234');

    const viewer1 = createMockClient({ displayName: 'Viewer1' });
    const viewer2 = createMockClient({ displayName: 'Viewer2' });
    room.addViewer(viewer1);
    room.addViewer(viewer2);

    const participants = room.getParticipants();
    expect(participants).toHaveLength(3);
    expect(participants[0]?.isHost).toBe(true);
    expect(participants[1]?.displayName).toBe('Viewer1');
    expect(participants[2]?.displayName).toBe('Viewer2');
  });

  it('should serialize to RoomInfo', () => {
    const host = createMockClient({ isHost: true, displayName: 'Host' });
    const room = new Room(host, 'ABC234');

    const info = room.toInfo();
    expect(info.code).toBe('ABC234');
    expect(info.hostDisplayName).toBe('Host');
    expect(info.state).toBe(RoomState.WAITING);
    expect(info.viewerIds).toEqual([]);
  });
});
