import type { ConnectionStatus as ConnStatus } from '../../types';

const statusConfig: Record<ConnStatus, { label: string; className: string }> = {
  disconnected: { label: 'Desconectado', className: 'status--disconnected' },
  connecting: { label: 'Conectando...', className: 'status--connecting' },
  connected: { label: 'Conectado', className: 'status--connected' },
  reconnecting: { label: 'Reconectando...', className: 'status--reconnecting' },
  error: { label: 'Erro', className: 'status--error' },
};

interface ConnectionStatusProps {
  status: ConnStatus;
  compact?: boolean;
}

export function ConnectionStatusBadge({
  status,
  compact = false,
}: ConnectionStatusProps): React.JSX.Element {
  const config = statusConfig[status];

  return (
    <span className={`connection-status ${config.className}`} role="status" aria-live="polite">
      <span className="connection-status__dot" />
      {!compact && <span className="connection-status__label">{config.label}</span>}
    </span>
  );
}
