import type {
  IceCandidateMessage,
  WebRtcAnswerMessage,
  WebRtcOfferMessage,
} from '@screenshare/shared';
import type { SocketEvent } from '../socket';
import type { ISocketClient, Participant } from '../../types';
import type {
  WebRtcManagerConfig,
  WebRtcManagerEvent,
  WebRtcManagerListener,
  WebRtcPeerStats,
} from './types';

const MAX_RECOMMENDED_MESH_PEERS = 4;

/**
 * Owns one RTCPeerConnection per remote participant.
 * Both peers can renegotiate after local tracks change. A deterministic polite
 * peer handles offer glare so simultaneous negotiation does not create two
 * competing connections.
 */
export class WebRtcManager {
  private readonly socketClient: ISocketClient;
  private readonly rtcConfiguration: RTCConfiguration | undefined;
  private readonly onEvent: ((event: WebRtcManagerEvent) => void) | undefined;
  private readonly listeners = new Set<WebRtcManagerListener>();
  private socketListenersAttached = false;
  private readonly peerConnectionFactory: (configuration?: RTCConfiguration) => RTCPeerConnection;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();
  private readonly remoteStreams = new Map<string, MediaStream>();
  private readonly negotiating = new Set<string>();
  private readonly negotiationPending = new Set<string>();
  private readonly pendingSignals: Array<WebRtcOfferMessage | WebRtcAnswerMessage | IceCandidateMessage> = [];
  private localStream: MediaStream | null = null;
  private localRoomCode: string | null = null;
  private localParticipantId: string | null = null;

  private readonly handleOfferEvent = (event: SocketEvent): void => {
    if (event.type === 'webrtcOffer') {
      this.enqueueOrHandleSignal(event.payload.data);
    }
  };

  private readonly handleAnswerEvent = (event: SocketEvent): void => {
    if (event.type === 'webrtcAnswer') {
      this.enqueueOrHandleSignal(event.payload.data);
    }
  };

  private readonly handleIceCandidateEvent = (event: SocketEvent): void => {
    if (event.type === 'iceCandidate') {
      this.enqueueOrHandleSignal(event.payload.data);
    }
  };

  constructor(socketClient: ISocketClient, config: WebRtcManagerConfig = {}) {
    this.socketClient = socketClient;
    this.rtcConfiguration = config.rtcConfiguration;
    this.onEvent = config.onEvent;
    this.peerConnectionFactory = config.peerConnectionFactory ?? ((configuration) => new RTCPeerConnection(configuration));
    this.start();
  }

  /** Reattach signaling listeners after a lifecycle cleanup. */
  start(): void {
    if (this.socketListenersAttached) return;
    this.socketClient.on('webrtcOffer', this.handleOfferEvent);
    this.socketClient.on('webrtcAnswer', this.handleAnswerEvent);
    this.socketClient.on('iceCandidate', this.handleIceCandidateEvent);
    this.socketListenersAttached = true;
  }

  /** Set the identity used to route locally generated signaling messages. */
  setLocalParticipant(
    roomCode: string | null,
    participantId: string | null,
    _isHost = false,
  ): void {

    this.localRoomCode = roomCode;
    this.localParticipantId = participantId;
    if (!roomCode || !participantId) {
      this.pendingSignals.length = 0;
      this.closeAllPeers();
      return;
    }

    const pendingSignals = this.pendingSignals.splice(0);
    for (const signal of pendingSignals) {
      this.enqueueOrHandleSignal(signal);
    }
  }

  /** Return an existing peer or create exactly one for the participant. */
  getOrCreatePeer(participantId: string): RTCPeerConnection {
    const existingPeer = this.peers.get(participantId);
    if (existingPeer) return existingPeer;

    const peer = this.peerConnectionFactory(this.rtcConfiguration);
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(participantId, event.candidate.toJSON());
      }
    };
    peer.ontrack = (event) => {
      const track = event.track;
      let stream = this.remoteStreams.get(participantId);
      if (!stream) {
        stream = event.streams[0] ?? new MediaStream([track]);
        this.remoteStreams.set(participantId, stream);
      } else if (!stream.getTracks().includes(track)) {
        stream.addTrack(track);
      }
      track.onended = () => this.removeRemoteTrack(participantId, stream, track);
      this.emit({ type: 'remoteStream', participantId, stream });
      console.log(`[WebRtcManager] Remote stream received participantId=${participantId}`);
    };
    peer.onnegotiationneeded = () => {
      void this.createOffer(participantId);
    };
    this.peers.set(participantId, peer);
    this.addLocalTracks(peer);
    peer.onconnectionstatechange = () => {
      this.emit({
        type: 'connectionStateChanged',
        participantId,
        state: peer.connectionState,
      });
      console.log(`[WebRTC] connectionState participantId=${participantId} state=${peer.connectionState}`);
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        this.closePeer(participantId);
      }
    };
    peer.oniceconnectionstatechange = () => {
      this.emit({
        type: 'iceConnectionStateChanged',
        participantId,
        state: peer.iceConnectionState,
      });
      console.log(`[WebRTC] iceConnectionState participantId=${participantId} state=${peer.iceConnectionState}`);
      if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'closed') {
        this.closePeer(participantId);
      }
    };
    peer.onicegatheringstatechange = () => {
      this.emit({
        type: 'iceGatheringStateChanged',
        participantId,
        state: peer.iceGatheringState,
      });
      console.log(`[WebRTC] iceGatheringState participantId=${participantId} state=${peer.iceGatheringState}`);
    };

    console.log(`[WebRTC] peer created participantId=${participantId}`);
    if (this.peers.size === MAX_RECOMMENDED_MESH_PEERS + 1) {
      console.warn(`[Performance] peerCount=${this.peers.size}; mesh may impact CPU and upload bandwidth`);
    }
    this.emit({ type: 'peerCreated', participantId });
    return peer;
  }

  getPeer(participantId: string): RTCPeerConnection | undefined {
    return this.peers.get(participantId);
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  /** Collect lightweight diagnostics without starting a polling loop. */
  async getPeerStats(participantId: string): Promise<WebRtcPeerStats | undefined> {
    const peer = this.peers.get(participantId);
    if (!peer) return undefined;

    const stats = await peer.getStats();
    const result: WebRtcPeerStats = {
      participantId,
      bytesSent: 0,
      bytesReceived: 0,
      packetsLost: 0,
      framesEncoded: 0,
      framesDecoded: 0,
      framesDropped: 0,
    };
    for (const report of stats.values()) {
      const entry = report as unknown as {
        type: string;
        state?: string;
        bytesSent?: number;
        bytesReceived?: number;
        packetsLost?: number;
        framesEncoded?: number;
        framesDecoded?: number;
        framesDropped?: number;
        framesPerSecond?: number;
        jitter?: number;
        roundTripTime?: number;
      };
      if (entry.type === 'outbound-rtp') {
        result.bytesSent += entry.bytesSent ?? 0;
        result.framesEncoded += entry.framesEncoded ?? 0;
        result.framesPerSecond ??= entry.framesPerSecond;
      } else if (entry.type === 'inbound-rtp') {
        result.bytesReceived += entry.bytesReceived ?? 0;
        result.packetsLost += entry.packetsLost ?? 0;
        result.framesDecoded += entry.framesDecoded ?? 0;
        result.framesDropped += entry.framesDropped ?? 0;
        result.framesPerSecond ??= entry.framesPerSecond;
        result.jitter ??= entry.jitter;
      } else if (entry.type === 'candidate-pair' && entry.state === 'succeeded') {
        result.roundTripTime ??= entry.roundTripTime;
      }
    }
    console.info(`[Performance] participantId=${participantId}`, result);
    return result;
  }

  /** Attach a local stream to all existing peers, without duplicate senders. */
  setLocalStream(stream: MediaStream): void {
    if (this.localStream === stream) return;
    this.clearLocalStream();
    this.localStream = stream;
    for (const [participantId, peer] of this.peers) {
      this.addLocalTracks(peer);
      void this.createOffer(participantId);
    }
  }

  /** Remove local tracks from peers without closing the peer connections. */
  clearLocalStream(): void {
    const stream = this.localStream;
    if (!stream) return;
    for (const peer of this.peers.values()) {
      for (const sender of peer.getSenders()) {
        if (sender.track && stream.getTracks().includes(sender.track)) {
          peer.removeTrack(sender);
        }
      }
    }
    this.localStream = null;
  }

  getRemoteStream(participantId: string): MediaStream | undefined {
    return this.remoteStreams.get(participantId);
  }

  getRemoteStreams(): ReadonlyMap<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  on(listener: WebRtcManagerListener): void {
    this.listeners.add(listener);
  }

  off(listener: WebRtcManagerListener): void {
    this.listeners.delete(listener);
  }

  /** Start one deterministic offer for each participant pair. */
  handleParticipantJoined(participant: Participant): void {
    if (participant.id !== this.localParticipantId && this.shouldInitiate(participant.id)) {
      void this.createOffer(participant.id);
    }
  }

  async createOffer(participantId: string): Promise<void> {
    if (!this.localRoomCode || !this.localParticipantId) return;

    this.negotiationPending.add(participantId);
    if (this.negotiating.has(participantId)) return;

    const peer = this.getOrCreatePeer(participantId);
    if (peer.signalingState !== 'stable') return;

    this.negotiationPending.delete(participantId);
    this.negotiating.add(participantId);
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const localDescription = peer.localDescription ?? offer;
      const sent = this.socketClient.sendWebRtcOffer(
        this.localRoomCode,
        this.localParticipantId,
        participantId,
        localDescription,
      );
      if (!sent) throw new Error('Could not send WebRTC offer');
      console.log(`[WebRTC] offer sent to=${participantId}`);
    } catch (error) {
      this.reportError(participantId, error);
    } finally {
      this.negotiating.delete(participantId);
      if (this.negotiationPending.has(participantId) && peer.signalingState === 'stable') {
        void this.createOffer(participantId);
      }
    }
  }

  private async handleOffer(message: WebRtcOfferMessage): Promise<void> {

    if (!this.isMessageForLocalRoom(message.payload.roomCode, message.payload.targetId)) return;

    const participantId = message.payload.participantId;

    const peer = this.getOrCreatePeer(participantId);
    const offerCollision = this.negotiating.has(participantId) || peer.signalingState !== 'stable';
    const isPolite = this.isPolitePeer(participantId);
    if (offerCollision && !isPolite) {
      console.log(`[WebRtcManager] Ignoring colliding offer from ${participantId}`);
      return;
    }

    try {
      if (offerCollision) {
        await peer.setLocalDescription({ type: 'rollback' });
      }
      await peer.setRemoteDescription(message.payload.sdp);
      await this.flushPendingIceCandidates(participantId, peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      if (!this.localRoomCode || !this.localParticipantId) return;
      const sent = this.socketClient.sendWebRtcAnswer(
        this.localRoomCode,
        this.localParticipantId,
        participantId,
        peer.localDescription ?? answer,
      );
      if (!sent) throw new Error('Could not send WebRTC answer');
      console.log(`[WebRTC] answer sent to=${participantId}`);
    } catch (error) {
      this.reportError(participantId, error);
    }
  }

  private async handleAnswer(message: WebRtcAnswerMessage): Promise<void> {
    if (!this.isMessageForLocalRoom(message.payload.roomCode, message.payload.targetId)) return;

    const participantId = message.payload.participantId;
    const peer = this.getPeer(participantId);
    if (!peer) {
      this.reportError(participantId, new Error('Received answer for an unknown peer'));
      return;
    }

    try {
      await peer.setRemoteDescription(message.payload.sdp);
      await this.flushPendingIceCandidates(participantId, peer);
      console.log(`[WebRtcManager] Answer received from ${participantId}`);
      if (this.negotiationPending.has(participantId)) {
        void this.createOffer(participantId);
      }
    } catch (error) {
      this.reportError(participantId, error);
    }
  }

  private async handleIceCandidate(message: IceCandidateMessage): Promise<void> {
    if (!this.isMessageForLocalRoom(message.payload.roomCode, message.payload.targetId)) return;

    const participantId = message.payload.participantId;
    const peer = this.getOrCreatePeer(participantId);
    try {
      if (peer.remoteDescription) {
        await peer.addIceCandidate(message.payload.candidate);
      } else {
        const pending = this.pendingIceCandidates.get(participantId) ?? [];
        pending.push(message.payload.candidate);
        this.pendingIceCandidates.set(participantId, pending);
      }
      console.log(`[WebRTC] ICE candidate received from=${participantId}`);
    } catch (error) {
      this.reportError(participantId, error);
    }
  }

  closePeer(participantId: string): void {
    const peer = this.peers.get(participantId);
    if (!peer) return;
    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.onnegotiationneeded = null;
    peer.onconnectionstatechange = null;
    peer.oniceconnectionstatechange = null;
    peer.onicegatheringstatechange = null;
    peer.close();
    this.peers.delete(participantId);
    this.pendingIceCandidates.delete(participantId);
    this.negotiating.delete(participantId);
    this.negotiationPending.delete(participantId);
    const remoteStream = this.remoteStreams.get(participantId);
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        track.stop();
      });
      this.remoteStreams.delete(participantId);
      this.emit({ type: 'remoteStreamRemoved', participantId });
    }
    console.log(`[WebRTC] peer closed participantId=${participantId}`);
    this.emit({ type: 'peerClosed', participantId });
  }

  closeAllPeers(): void {
    for (const participantId of [...this.peers.keys()]) {
      this.closePeer(participantId);
    }
    this.pendingIceCandidates.clear();
    this.negotiating.clear();
    this.negotiationPending.clear();
  }

  dispose(): void {
    this.clearLocalStream();
    this.socketClient.off('webrtcOffer', this.handleOfferEvent);
    this.socketClient.off('webrtcAnswer', this.handleAnswerEvent);
    this.socketClient.off('iceCandidate', this.handleIceCandidateEvent);
    this.socketListenersAttached = false;
    this.closeAllPeers();
    this.pendingSignals.length = 0;
    this.localRoomCode = null;
    this.localParticipantId = null;
    this.listeners.clear();
  }

  private addLocalTracks(peer: RTCPeerConnection): void {
    if (!this.localStream) return;
    for (const track of this.localStream.getTracks()) {
      const alreadyAdded = peer.getSenders().some((sender) => sender.track === track);
      if (!alreadyAdded) {
        const sender = peer.addTrack(track, this.localStream);
        this.configureSender(sender, track);
      }
    }
  }

  private configureSender(sender: RTCRtpSender, track: MediaStreamTrack): void {
    if ('contentHint' in track) {
      track.contentHint = 'detail';
    }
    if (typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') return;

    const parameters = sender.getParameters();
    const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
    const maxBitrate = settings.width && settings.width > 1280 ? 4_000_000 : 2_500_000;
    const encoding = parameters.encodings?.[0] ?? {};
    parameters.encodings = [{
      ...encoding,
      maxBitrate,
      ...(settings.frameRate ? { maxFramerate: settings.frameRate } : {}),
    }];
    void sender.setParameters(parameters).catch((error: unknown) => {
      console.warn('[WebRTC] Sender parameters unavailable:', error);
    });
  }

  private async flushPendingIceCandidates(
    participantId: string,
    peer: RTCPeerConnection,
  ): Promise<void> {
    const pending = this.pendingIceCandidates.get(participantId);
    if (!pending) return;
    this.pendingIceCandidates.delete(participantId);
    for (const candidate of pending) {
      await peer.addIceCandidate(candidate);
    }
  }

  private removeRemoteTrack(participantId: string, stream: MediaStream, track: MediaStreamTrack): void {
    if (this.remoteStreams.get(participantId) !== stream) return;
    if (stream.getTracks().length > 1 && typeof stream.removeTrack === 'function') {
      stream.removeTrack(track);
      track.onended = null;
      this.emit({ type: 'remoteStream', participantId, stream });
      return;
    }
    track.onended = null;
    stream.getTracks().forEach((remainingTrack) => {
      remainingTrack.onended = null;
      remainingTrack.onmute = null;
      remainingTrack.onunmute = null;
      remainingTrack.stop();
    });
    this.remoteStreams.delete(participantId);
    this.emit({ type: 'remoteStreamRemoved', participantId });
  }

  private sendIceCandidate(participantId: string, candidate: RTCIceCandidateInit): void {
    if (!this.localRoomCode || !this.localParticipantId) return;
    const sent = this.socketClient.sendIceCandidate(
      this.localRoomCode,
      this.localParticipantId,
      participantId,
      candidate,
    );
    if (sent) console.log(`[WebRTC] ICE candidate sent to=${participantId}`);
  }

  private enqueueOrHandleSignal(
    signal: WebRtcOfferMessage | WebRtcAnswerMessage | IceCandidateMessage,
  ): void {
    if (!this.localRoomCode || !this.localParticipantId) {

      this.pendingSignals.push(signal);
      return;
    }


    switch (signal.type) {
      case 'WEBRTC_OFFER':
        void this.handleOffer(signal);
        break;
      case 'WEBRTC_ANSWER':
        void this.handleAnswer(signal);
        break;
      case 'ICE_CANDIDATE':
        void this.handleIceCandidate(signal);
        break;
    }
  }

  private isMessageForLocalRoom(roomCode: string, targetId: string): boolean {
    return roomCode === this.localRoomCode && targetId === this.localParticipantId;
  }

  /** The lexicographically smaller participant creates the initial offer. */
  private shouldInitiate(participantId: string): boolean {
    return (this.localParticipantId ?? '') < participantId;
  }

  /** The lexicographically larger participant is polite during offer glare. */
  private isPolitePeer(participantId: string): boolean {
    return !this.shouldInitiate(participantId);
  }

  private reportError(participantId: string, error: unknown): void {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    console.error(`[WebRtcManager] Peer ${participantId} error:`, normalizedError);
    this.emit({ type: 'error', participantId, error: normalizedError });
  }

  private emit(event: WebRtcManagerEvent): void {
    this.onEvent?.(event);
    this.listeners.forEach((listener) => listener(event));
  }
}
