import { Monitor } from 'lucide-react';

/** Placeholder for the video area — ready for WebRTC integration. */
export function VideoPlaceholder(): React.JSX.Element {
  return (
    <div className="video-placeholder" role="region" aria-label="Área de vídeo">
      <Monitor size={48} className="video-placeholder__icon" />
      <p className="video-placeholder__text">Aguardando transmissão</p>
    </div>
  );
}
