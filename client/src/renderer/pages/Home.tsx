import { Monitor, Plus, LogIn } from 'lucide-react';
import { Button } from '../components/ui';
import { useNavigate } from '../state/AppContext';
import { MainLayout } from '../layouts/MainLayout';

export function HomePage(): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="page page--home">
        <div className="home">
          <div className="home__brand">
            <div className="home__logo">
              <Monitor size={32} />
            </div>
            <h1 className="home__title">ScreenShare</h1>
            <p className="home__subtitle">Compartilhe sua tela com seus amigos.</p>
          </div>

          <div className="home__actions">
            <Button
              variant="primary"
              size="lg"
              icon={<Plus size={18} />}
              onClick={() => navigate('create-room')}
              fullWidth
            >
              Criar sala
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<LogIn size={18} />}
              onClick={() => navigate('join-room')}
              fullWidth
            >
              Entrar em uma sala
            </Button>
          </div>

          <p className="home__hint">Compartilhamento de tela em tempo real</p>
        </div>
      </div>
    </MainLayout>
  );
}
