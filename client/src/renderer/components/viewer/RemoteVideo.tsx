import { useEffect, useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface RemoteVideoProps {
  participantId: string;
  participantName: string;
  stream: MediaStream;
  isFocused: boolean;
  onToggleFocus: (participantId: string) => void;
}

/** Renders one remote MediaStream without owning or stopping the stream. */
export function RemoteVideo({
  participantId,
  participantName,
  stream,
  isFocused,
  onToggleFocus,
}: RemoteVideoProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <article className={`remote-video${isFocused ? ' remote-video--focused' : ''}`}>
      <video
        ref={videoRef}
        className="remote-video__element"
        autoPlay
        playsInline
        muted
        aria-label={`Tela compartilhada por ${participantName}`}
      />
      <div className="remote-video__overlay">
        <span className="remote-video__name">{participantName}</span>
        <button
          type="button"
          className="remote-video__focus-button"
          onClick={() => onToggleFocus(participantId)}
          aria-label={isFocused ? 'Voltar ao grid' : `Expandir tela de ${participantName}`}
          title={isFocused ? 'Voltar ao grid' : 'Expandir'}
        >
          {isFocused ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
    </article>
  );
}
