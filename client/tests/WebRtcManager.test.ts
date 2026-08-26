import {
  SignalingMessageType,
  type AnySignalingMessage,
  type WebRtcOfferMessage,
} from '@screenshare/shared';
import { WebRtcManager } from '../src/renderer/services/webrtc/WebRtcManager';
import type {
  ISocketClient,
  Participant,
} from '../src/renderer/types';
import type {
  SocketEvent,
  SocketEventListener,
  SocketEventType,
} from '../src/renderer/services/socket/types';

class FakeSocketClient implements ISocketClient {
  readonly sent: AnySignalingMessage[] = [];
  private readonly listeners = new Map<SocketEventType, Set<SocketEventListener>>();

  connect(): void { return undefined; }
  disconnect(): void { return undefined; }
  createRoom(): boolean { return true; }
  joinRoom(): boolean { return true; }
  leaveRoom(): boolean { return true; }
  sendSharingState(): boolean { return true; }
  sendWebRtcOffer(roomCode: string, participantId: string, targetId: string, sdp: RTCSessionDescriptionInit): boolean {
    this.sent.push({ type: SignalingMessageType.WEBRTC_OFFER, payload: { roomCode, participantId, targetId, sdp } });
    return true;
  }
  sendWebRtcAnswer(roomCode: string, participantId: string, targetId: string, sdp: RTCSessionDescriptionInit): boolean {
    this.sent.push({ type: SignalingMessageType.WEBRTC_ANSWER, payload: { roomCode, participantId, targetId, sdp } });
    return true;
  }
  sendIceCandidate(roomCode: string, participantId: string, targetId: string, candidate: RTCIceCandidateInit): boolean {
    this.sent.push({ type: SignalingMessageType.ICE_CANDIDATE, payload: { roomCode, participantId, targetId, candidate } });
    return true;
  }
  on(type: SocketEventType, listener: SocketEventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<SocketEventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  off(type: SocketEventType, listener: SocketEventListener): void {
    this.listeners.get(type)?.delete(listener);
  }
  getState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' { return 'connected'; }
  isReady(): boolean { return true; }
  waitUntilReady(): Promise<boolean> { return Promise.resolve(true); }
  getClientId(): string { return 'client'; }
  emit(event: SocketEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }
}

class RoutingSocketClient extends FakeSocketClient {
  constructor(
    private readonly participantId: string,
    private readonly clients: Map<string, RoutingSocketClient>,
  ) {
    super();
  }

  override sendWebRtcOffer(roomCode: string, _participantId: string, targetId: string, sdp: RTCSessionDescriptionInit): boolean {
    const sent = super.sendWebRtcOffer(roomCode, this.participantId, targetId, sdp);
    this.clients.get(targetId)?.emit({
      type: 'webrtcOffer',
      payload: { type: 'webrtcOffer', data: { type: SignalingMessageType.WEBRTC_OFFER, payload: { roomCode, participantId: this.participantId, targetId, sdp } } },
    });
    return sent;
  }

  override sendWebRtcAnswer(roomCode: string, _participantId: string, targetId: string, sdp: RTCSessionDescriptionInit): boolean {
    const sent = super.sendWebRtcAnswer(roomCode, this.participantId, targetId, sdp);
    this.clients.get(targetId)?.emit({
      type: 'webrtcAnswer',
      payload: { type: 'webrtcAnswer', data: { type: SignalingMessageType.WEBRTC_ANSWER, payload: { roomCode, participantId: this.participantId, targetId, sdp } } },
    });
    return sent;
  }

  override sendIceCandidate(roomCode: string, _participantId: string, targetId: string, candidate: RTCIceCandidateInit): boolean {
    const sent = super.sendIceCandidate(roomCode, this.participantId, targetId, candidate);
    this.clients.get(targetId)?.emit({
      type: 'iceCandidate',
      payload: { type: 'iceCandidate', data: { type: SignalingMessageType.ICE_CANDIDATE, payload: { roomCode, participantId: this.participantId, targetId, candidate } } },
    });
    return sent;
  }
}

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  addedCandidates: RTCIceCandidateInit[] = [];
  readonly stats = new Map<string, object>();
  readonly senders: RTCRtpSender[] = [];
  addedTracks: MediaStreamTrack[] = [];
  closed = false;

  async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: 'offer', sdp: 'offer' }; }
  async createAnswer(): Promise<RTCSessionDescriptionInit> { return { type: 'answer', sdp: 'answer' }; }
  async setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void> {
    if (description?.type === 'rollback') {
      this.signalingState = 'stable';
      this.localDescription = null;
    } else if (description) {
      this.localDescription = description as RTCSessionDescription;
      this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
    }
    await Promise.resolve();
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description as RTCSessionDescription;
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> { this.addedCandidates.push(candidate); }
  async getStats(): Promise<RTCStatsReport> { return this.stats as unknown as RTCStatsReport; }
  getSenders(): RTCRtpSender[] { return this.senders; }
  addTrack(track: MediaStreamTrack): RTCRtpSender {
    this.addedTracks.push(track);
    const sender = { track } as RTCRtpSender;
    this.senders.push(sender);
    this.onnegotiationneeded?.();
    return sender;
  }
  removeTrack(sender: RTCRtpSender): void {
    const index = this.senders.indexOf(sender);
    if (index >= 0) {
      this.senders.splice(index, 1);
      this.onnegotiationneeded?.();
    }
  }
  close(): void { this.closed = true; this.connectionState = 'closed'; }
}

const participant: Participant = {
  id: 'remote',
  displayName: 'Remote',
  isHost: false,
  isSharing: false,
};

const waitForMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('WebRtcManager', () => {
  it('creates one offer peer for a joined participant', async () => {
    const socket = new FakeSocketClient();
    const peers: FakePeerConnection[] = [];
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => {
        const peer = new FakePeerConnection();
        peers.push(peer);
        return peer as unknown as RTCPeerConnection;
      },
    });
    manager.setLocalParticipant('ROOM01', 'local', true);

    manager.handleParticipantJoined(participant);
    manager.handleParticipantJoined(participant);
    await waitForMicrotasks();

    expect(peers).toHaveLength(1);
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]?.type).toBe(SignalingMessageType.WEBRTC_OFFER);
    manager.dispose();
  });

  it('adds local tracks once to existing and new peers', () => {
    const socket = new FakeSocketClient();
    const peers: FakePeerConnection[] = [];
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => {
        const peer = new FakePeerConnection();
        peers.push(peer);
        return peer as unknown as RTCPeerConnection;
      },
    });
    const track = {} as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    manager.setLocalParticipant('ROOM01', 'local', true);
    manager.getOrCreatePeer('remote');
    manager.setLocalStream(stream);
    manager.setLocalStream(stream);
    manager.getOrCreatePeer('new-remote');

    expect(peers[0]?.addedTracks).toHaveLength(1);
    expect(peers[1]?.addedTracks).toHaveLength(1);
    manager.clearLocalStream();
    expect(peers[0]?.senders).toHaveLength(0);
    manager.dispose();
  });

  it('stores remote tracks by participant and removes them with the peer', () => {
    const socket = new FakeSocketClient();
    const peer = new FakePeerConnection();
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => peer as unknown as RTCPeerConnection,
    });
    const remoteStream = { getTracks: () => [] } as unknown as MediaStream;
    manager.setLocalParticipant('ROOM01', 'local', false);
    const createdPeer = manager.getOrCreatePeer('remote');
    createdPeer.ontrack?.({ track: {} as MediaStreamTrack, streams: [remoteStream] } as unknown as RTCTrackEvent);

    expect(manager.getRemoteStream('remote')).toBe(remoteStream);
    manager.closePeer('remote');
    expect(manager.getRemoteStream('remote')).toBeUndefined();
    manager.dispose();
  });

  it('keeps independent remote streams for multiple participants', () => {
    const socket = new FakeSocketClient();
    const peers = new Map<string, FakePeerConnection>();
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => {
        const peer = new FakePeerConnection();
        return peer as unknown as RTCPeerConnection;
      },
    });
    manager.setLocalParticipant('ROOM01', 'local', false);

    for (const participantId of ['participant-a', 'participant-b', 'participant-c']) {
      const peer = manager.getOrCreatePeer(participantId) as unknown as FakePeerConnection & {
        ontrack: ((event: RTCTrackEvent) => void) | null;
      };
      peers.set(participantId, peer);
      const track = { onended: null, stop: jest.fn() } as unknown as MediaStreamTrack;
      const stream = { getTracks: () => [track] } as unknown as MediaStream;
      peer.ontrack?.({ track, streams: [stream] } as unknown as RTCTrackEvent);
      expect(manager.getRemoteStream(participantId)).toBe(stream);
    }

    expect(manager.getRemoteStreams().size).toBe(3);
    expect(manager.getRemoteStream('participant-a')).not.toBe(manager.getRemoteStream('participant-b'));
    manager.closePeer('participant-b');
    expect(manager.getRemoteStream('participant-a')).toBeDefined();
    expect(manager.getRemoteStream('participant-c')).toBeDefined();
    expect(manager.getRemoteStream('participant-b')).toBeUndefined();
    manager.dispose();
  });

  it('renegotiates when sharing starts, stops, and starts again', async () => {
    const socket = new FakeSocketClient();
    const peer = new FakePeerConnection();
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => peer as unknown as RTCPeerConnection,
    });
    manager.setLocalParticipant('ROOM01', 'a', false);
    manager.getOrCreatePeer('b');
    await waitForMicrotasks();
    socket.sent.length = 0;

    const firstTrack = {} as MediaStreamTrack;
    manager.setLocalStream({ getTracks: () => [firstTrack] } as unknown as MediaStream);
    await waitForMicrotasks();
    expect(peer.addedTracks).toContain(firstTrack);
    expect(socket.sent.filter((message) => message.type === SignalingMessageType.WEBRTC_OFFER)).toHaveLength(1);

    const answer = (): void => {
      peer.signalingState = 'stable';
      socket.emit({
        type: 'webrtcAnswer',
        payload: { type: 'webrtcAnswer', data: {
          type: SignalingMessageType.WEBRTC_ANSWER,
          payload: { roomCode: 'ROOM01', participantId: 'b', targetId: 'a', sdp: { type: 'answer', sdp: 'answer' } },
        } },
      });
    };
    answer();
    await waitForMicrotasks();

    manager.clearLocalStream();
    await waitForMicrotasks();
    expect(socket.sent.filter((message) => message.type === SignalingMessageType.WEBRTC_OFFER)).toHaveLength(2);
    answer();
    await waitForMicrotasks();

    const secondTrack = {} as MediaStreamTrack;
    manager.setLocalStream({ getTracks: () => [secondTrack] } as unknown as MediaStream);
    await waitForMicrotasks();
    expect(peer.addedTracks).toContain(secondTrack);
    expect(socket.sent.filter((message) => message.type === SignalingMessageType.WEBRTC_OFFER)).toHaveLength(3);
    answer();
    await waitForMicrotasks();

    const remoteStream = { getTracks: () => [] } as unknown as MediaStream;
    const remoteEvents: string[] = [];
    manager.on((event) => {
      if (event.type === 'remoteStream') remoteEvents.push(event.participantId);
    });
    peer.ontrack?.({ track: {} as MediaStreamTrack, streams: [remoteStream] } as unknown as RTCTrackEvent);
    expect(manager.getRemoteStream('b')).toBe(remoteStream);
    expect(remoteEvents).toEqual(['b']);
    expect(manager.getPeer('b')).toBe(peer as unknown as RTCPeerConnection);
    manager.dispose();
  });

  it('aggregates peer stats on demand without starting a polling timer', async () => {
    const socket = new FakeSocketClient();
    const peer = new FakePeerConnection();
    peer.stats.set('outbound', { type: 'outbound-rtp', bytesSent: 1000, framesEncoded: 20, framesPerSecond: 30 });
    peer.stats.set('inbound', { type: 'inbound-rtp', bytesReceived: 2000, packetsLost: 2, framesDecoded: 18, framesDropped: 1, jitter: 0.02 });
    peer.stats.set('candidate', { type: 'candidate-pair', state: 'succeeded', roundTripTime: 0.04 });
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => peer as unknown as RTCPeerConnection,
    });
    manager.setLocalParticipant('ROOM01', 'local', false);
    manager.getOrCreatePeer('remote');

    await expect(manager.getPeerStats('remote')).resolves.toMatchObject({
      participantId: 'remote',
      bytesSent: 1000,
      bytesReceived: 2000,
      packetsLost: 2,
      framesEncoded: 20,
      framesDecoded: 18,
      framesDropped: 1,
      framesPerSecond: 30,
      jitter: 0.02,
      roundTripTime: 0.04,
    });
    manager.dispose();
  });

  it('uses one deterministic offer initiator for each participant pair', async () => {
    const socket = new FakeSocketClient();
    const peers: FakePeerConnection[] = [];
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => {
        const peer = new FakePeerConnection();
        peers.push(peer);
        return peer as unknown as RTCPeerConnection;
      },
    });
    manager.setLocalParticipant('ROOM01', 'participant-b', false);

    manager.handleParticipantJoined({ ...participant, id: 'participant-a' });
    manager.handleParticipantJoined({ ...participant, id: 'participant-c' });
    await waitForMicrotasks();

    expect(peers).toHaveLength(1);
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({
      type: SignalingMessageType.WEBRTC_OFFER,
      payload: { targetId: 'participant-c' },
    });
    manager.dispose();
  });

  it('routes independent A/B/C streams to the correct remote peer after connection', async () => {
    const clients = new Map<string, RoutingSocketClient>();
    const managers = new Map<string, WebRtcManager>();
    const peers = new Map<string, Map<string, FakePeerConnection>>();
    for (const localId of ['a', 'b', 'c']) {
      const socket = new RoutingSocketClient(localId, clients);
      clients.set(localId, socket);
      const localPeers = new Map<string, FakePeerConnection>();
      peers.set(localId, localPeers);
      managers.set(localId, new WebRtcManager(socket, {
        peerConnectionFactory: () => {
          const peer = new FakePeerConnection();
          return peer as unknown as RTCPeerConnection;
        },
      }));
      managers.get(localId)?.setLocalParticipant('ROOM01', localId, localId === 'a');
    }

    const participants = ['a', 'b', 'c'];
    for (const localId of participants) {
      for (const remoteId of participants) {
        if (localId === remoteId) continue;
        const peer = managers.get(localId)?.getOrCreatePeer(remoteId) as unknown as FakePeerConnection;
        peers.get(localId)?.set(remoteId, peer);
      }
    }
    await waitForMicrotasks();

    for (const localId of participants) {
      const manager = managers.get(localId);
      for (const remoteId of participants) {
        if (localId === remoteId) continue;
        const stream = { id: `stream-${remoteId}`, getTracks: () => [] } as unknown as MediaStream;
        peers.get(localId)?.get(remoteId)?.ontrack?.({
          track: { id: `track-${remoteId}`, kind: 'video', onended: null } as unknown as MediaStreamTrack,
          streams: [stream],
        } as unknown as RTCTrackEvent);
        expect(manager?.getRemoteStream(remoteId)).toBe(stream);
      }
    }

    expect(managers.get('a')?.getRemoteStreams().size).toBe(2);
    expect(managers.get('b')?.getRemoteStreams().size).toBe(2);
    expect(managers.get('c')?.getRemoteStreams().size).toBe(2);
    expect(managers.get('a')?.getRemoteStream('b')?.id).toBe('stream-b');
    expect(managers.get('a')?.getRemoteStream('c')?.id).toBe('stream-c');
    expect(managers.get('b')?.getRemoteStream('a')?.id).toBe('stream-a');
    expect(managers.get('c')?.getRemoteStream('a')?.id).toBe('stream-a');

    for (const manager of managers.values()) manager.dispose();
  });

  it('answers an offer and flushes ICE queued before remote description', async () => {
    const socket = new FakeSocketClient();
    const peer = new FakePeerConnection();
    const manager = new WebRtcManager(socket, {
      peerConnectionFactory: () => peer as unknown as RTCPeerConnection,
    });
    manager.setLocalParticipant('ROOM01', 'local', false);

    const candidate = { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 };
    socket.emit({
      type: 'iceCandidate',
      payload: { type: 'iceCandidate', data: {
        type: SignalingMessageType.ICE_CANDIDATE,
        payload: { roomCode: 'ROOM01', participantId: 'remote', targetId: 'local', candidate },
      } },
    });
    await waitForMicrotasks();
    expect(peer.addedCandidates).toHaveLength(0);

    const offer: WebRtcOfferMessage = {
      type: SignalingMessageType.WEBRTC_OFFER,
      payload: {
        roomCode: 'ROOM01',
        participantId: 'remote',
        targetId: 'local',
        sdp: { type: 'offer', sdp: 'offer' },
      },
    };
    socket.emit({ type: 'webrtcOffer', payload: { type: 'webrtcOffer', data: offer } });
    await waitForMicrotasks();

    expect(peer.addedCandidates).toEqual([candidate]);
    expect(socket.sent.some((message) => message.type === 'WEBRTC_ANSWER')).toBe(true);
    manager.closePeer('remote');
    expect(peer.closed).toBe(true);
    manager.dispose();
  });
});
