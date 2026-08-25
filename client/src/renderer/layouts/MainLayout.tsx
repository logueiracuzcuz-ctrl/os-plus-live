import { type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useAppState } from '../state/AppContext';
import { ConnectionStatusBadge } from '../components/ui';

interface MainLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  title?: string;
}

export function MainLayout({ children, showBack = false, title }: MainLayoutProps): React.JSX.Element {
  const navigate = useNavigate();
  const { connectionStatus } = useAppState();

  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__header-left">
          {showBack && (
            <button
              type="button"
              className="layout__back"
              onClick={() => navigate('home')}
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {title && <h1 className="layout__title">{title}</h1>}
        </div>
        <div className="layout__header-right">
          <ConnectionStatusBadge status={connectionStatus} compact />
        </div>
      </header>

      <main className="layout__content">{children}</main>
    </div>
  );
}
