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

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  addedCandidates: RTCIceCandidateInit[] = [];
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
  getSenders(): RTCRtpSender[] { return this.senders; }
  addTrack(track: MediaStreamTrack): RTCRtpSender {
    this.addedTracks.push(track);
    const sender = { track } as RTCRtpSender;
    this.senders.push(sender);
    return sender;
  }
  removeTrack(sender: RTCRtpSender): void {
    const index = this.senders.indexOf(sender);
    if (index >= 0) this.senders.splice(index, 1);
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
