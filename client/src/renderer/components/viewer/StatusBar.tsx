import { Maximize2, Volume2, Gauge, Wifi, Activity } from 'lucide-react';
import type { ConnectionStatus } from '../../types';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  fps?: number;
  latency?: number;
  onFullscreen?: () => void;
}

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  reconnecting: 'Reconectando',
  error: 'Erro',
};

export function StatusBar({
  connectionStatus,
  fps,
  latency,
  onFullscreen,
}: StatusBarProps): React.JSX.Element {
  return (
    <div className="status-bar" role="toolbar" aria-label="Controles do visualizador">
      <button type="button" className="status-bar__btn" onClick={onFullscreen} aria-label="Tela cheia" title="Tela cheia">
        <Maximize2 size={18} />
      </button>

      <div className="status-bar__spacer" />

      <div className="status-bar__info">
        <span className="status-bar__item" title="Áudio">
          <Volume2 size={14} />
        </span>
        {fps !== undefined && (
          <span className="status-bar__item" title="FPS">
            <Gauge size={14} />
            <span>{fps}</span>
          </span>
        )}
        {latency !== undefined && (
          <span className="status-bar__item" title="Latência">
            <Activity size={14} />
            <span>{latency}ms</span>
          </span>
        )}
        <span
          className={`status-bar__item status-bar__item--${connectionStatus}`}
          title={statusLabels[connectionStatus]}
        >
          <Wifi size={14} />
        </span>
      </div>
    </div>
  );
}
