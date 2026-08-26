import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { Participant } from '../../types';
import { useScreenCapture, useWebRtcManager } from '../../state/AppContext';
import type { ScreenCaptureEvent } from '../../services/screen';
import type { WebRtcManagerEvent } from '../../services/webrtc';
import { ParticipantList } from './ParticipantList';
import { VideoPlaceholder } from '../viewer/VideoPlaceholder';

interface RoomMediaViewProps {
  participants: Participant[];
  currentUserId: string;
}

interface SelectedVideoProps {
  participantId: string;
  stream: MediaStream;
  participantName: string;
  isFocused: boolean;
  onToggleFocus: () => void;
}

const SelectedVideo = memo(function SelectedVideo({ participantId, stream, participantName, isFocused, onToggleFocus }: SelectedVideoProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    console.log(`[WebRTC UI STREAM] selectedParticipantId=${participantId} streamParticipantId=${participantId} streamId=${stream.id} videoSrcObject=${video.srcObject ? 'set' : 'null'} readyState=${video.readyState} paused=${video.paused}`);
    void video.play().then(() => {
      console.log(`[UI] stream attached participantId=${participantId}`);
    }).catch(() => {
      // Autoplay can be rejected by a browser policy; the muted video remains ready to play.
    });
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [participantId, stream]);

  return (
    <div className="selected-video">
      <video
        ref={videoRef}
        className="selected-video__element"
        autoPlay
        playsInline
        muted
        aria-label={`Tela compartilhada por ${participantName}`}
      />
      <div className="selected-video__label">{participantName}</div>
      <button
        type="button"
        className="selected-video__focus-button"
        onClick={onToggleFocus}
        aria-label={isFocused ? 'Voltar ao layout normal' : 'Expandir transmissão'}
        title={isFocused ? 'Voltar ao layout normal' : 'Expandir transmissão'}
      >
        {isFocused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </div>
  );
});

/** Main room view: one selected participant stream and a clickable participant list. */
export function RoomMediaView({ participants, currentUserId }: RoomMediaViewProps): React.JSX.Element {
  const screenCapture = useScreenCapture();
  const webRtcManager = useWebRtcManager();
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(currentUserId);
  const [isFocused, setIsFocused] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(() => screenCapture?.getStream() ?? null);
  const [remoteStreams, setRemoteStreams] = useState<ReadonlyMap<string, MediaStream>>(
    () => webRtcManager ? new Map(webRtcManager.getRemoteStreams()) : new Map(),
  );

  useEffect(() => {
    if (!participants.some((participant) => participant.id === selectedParticipantId)) {
      setSelectedParticipantId(null);
    }
  }, [participants, selectedParticipantId]);

  useEffect(() => {
    if (!webRtcManager) return;
    setRemoteStreams(new Map(webRtcManager.getRemoteStreams()));
    const handleManagerEvent = (event: WebRtcManagerEvent): void => {
      if (event.type === 'remoteStream') {
        console.log(`[WebRTC UI] remote stream available participantId=${event.participantId} streamExists=true`);
        setRemoteStreams((current) => new Map(current).set(event.participantId, event.stream));
      } else if (event.type === 'remoteStreamRemoved') {
        setRemoteStreams((current) => {
          const next = new Map(current);
          next.delete(event.participantId);
          return next;
        });
      }
    };
    webRtcManager.on(handleManagerEvent);
    return () => webRtcManager.off(handleManagerEvent);
  }, [webRtcManager]);

  useEffect(() => {
    if (!screenCapture) return;
    const handleCaptureEvent = (event: ScreenCaptureEvent): void => {
      if (event.type === 'started') setLocalStream(event.stream);
      if (event.type === 'stopped') setLocalStream(null);
    };
    setLocalStream(screenCapture.getStream());
    screenCapture.on(handleCaptureEvent);
    return () => screenCapture.off(handleCaptureEvent);
  }, [screenCapture]);

  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId);
  const toggleFocus = useCallback(() => setIsFocused((focused) => !focused), []);
  const selectedStream = selectedParticipantId === currentUserId
    ? localStream
    : selectedParticipantId ? remoteStreams.get(selectedParticipantId) ?? null : null;

  useEffect(() => {
    console.log(`[WebRTC UI] selectedParticipant=${selectedParticipantId ?? 'none'} streamParticipantId=${selectedParticipantId ?? 'none'} streamExists=${Boolean(selectedStream)}`);
    if (!selectedStream) setIsFocused(false);
  }, [selectedParticipantId, selectedStream]);

  return (
    <section className={`room-media-view${isFocused ? ' room-media-view--focused' : ''}`} aria-label="Visualização da sala">
      <div className="room-media-view__stage">
        {selectedStream && selectedParticipant
          ? <SelectedVideo
              participantId={selectedParticipantId ?? currentUserId}
              stream={selectedStream}
              participantName={selectedParticipant.displayName}
              isFocused={isFocused}
              onToggleFocus={toggleFocus}
            />
          : <VideoPlaceholder />}
      </div>
      <div className="room-media-view__participants">
        <div className="participant-list__header">
          <span>Participantes</span>
          <span>{participants.length}</span>
        </div>
        <ParticipantList
          participants={participants}
          currentUserId={currentUserId}
          selectedParticipantId={selectedParticipantId}
          onSelect={setSelectedParticipantId}
        />
      </div>
    </section>
  );
}
