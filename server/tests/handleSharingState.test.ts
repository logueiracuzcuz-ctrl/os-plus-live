import { SignalingMessageType } from '@screenshare/shared';
import { handleIncomingFrame } from '../src/handleIncomingFrame';
import { RoomManager, type ClientConnection } from '../src/RoomManager';

function createMockWs(): ClientConnection['ws'] {
  return {
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
  } as unknown as ClientConnection['ws'];
}

describe('participant sharing state signaling', () => {
  it('persists and broadcasts sharing changes only within the room', () => {
    const roomManager = new RoomManager();
    const hostWs = createMockWs();
    const viewerWs = createMockWs();
    const created = handleIncomingFrame(
      hostWs,
      JSON.stringify({ type: SignalingMessageType.CREATE_ROOM, payload: { displayName: 'Host' } }),
      roomManager,
    );
    if (created?.type !== SignalingMessageType.ROOM_CREATED) throw new Error('Room was not created');

    const joined = handleIncomingFrame(
      viewerWs,
      JSON.stringify({
        type: SignalingMessageType.JOIN_ROOM,
        payload: { roomCode: created.payload.roomCode, displayName: 'Viewer' },
      }),
      roomManager,
    );
    if (joined?.type !== SignalingMessageType.ROOM_JOINED) throw new Error('Viewer did not join');

    const broadcasts: unknown[] = [];
    const sharingMessage = JSON.stringify({
      type: SignalingMessageType.PARTICIPANT_SHARING_CHANGED,
      payload: {
        roomCode: created.payload.roomCode,
        participantId: joined.payload.participantId,
        isSharing: true,
      },
    });
    const response = handleIncomingFrame(
      viewerWs,
      sharingMessage,
      roomManager,
      (_room, message) => broadcasts.push(message),
    );

    expect(response).toBeNull();
    expect(broadcasts).toHaveLength(1);
    expect(roomManager.getRoomByCode(created.payload.roomCode)?.getParticipants()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: joined.payload.participantId, isSharing: true })]),
    );

    handleIncomingFrame(
      viewerWs,
      sharingMessage.replace('"isSharing":true', '"isSharing":false'),
      roomManager,
      (_room, message) => broadcasts.push(message),
    );
    expect(roomManager.getRoomByCode(created.payload.roomCode)?.getParticipants()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: joined.payload.participantId, isSharing: false })]),
    );
  });

  it('rejects a participant state update sent by another connection', () => {
    const roomManager = new RoomManager();
    const hostWs = createMockWs();
    const attackerWs = createMockWs();
    const created = handleIncomingFrame(
      hostWs,
      JSON.stringify({ type: SignalingMessageType.CREATE_ROOM, payload: { displayName: 'Host' } }),
      roomManager,
    );
    if (created?.type !== SignalingMessageType.ROOM_CREATED) throw new Error('Room was not created');

    const response = handleIncomingFrame(
      attackerWs,
      JSON.stringify({
        type: SignalingMessageType.PARTICIPANT_SHARING_CHANGED,
        payload: { roomCode: created.payload.roomCode, participantId: created.payload.participantId, isSharing: true },
      }),
      roomManager,
    );

    expect(response).toMatchObject({
      type: SignalingMessageType.ERROR,
      payload: { code: 'PARTICIPANT_NOT_IN_ROOM' },
    });
  });
});
