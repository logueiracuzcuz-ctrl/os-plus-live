import { useAppState } from '../../state/AppContext';
import type { ToastType } from '../../types';

const iconMap: Record<ToastType, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export function ToastContainer(): React.JSX.Element {
  const { toasts } = useAppState();

  return (
    <div className="toast-container" aria-live="polite" aria-label="Notificações">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`} role="status">
          <span className="toast__icon" aria-hidden="true">
            {iconMap[toast.type]}
          </span>
          <span className="toast__message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
