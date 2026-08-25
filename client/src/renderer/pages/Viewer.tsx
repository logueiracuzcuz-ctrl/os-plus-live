import { useAppState, useNavigate, useSocketClient, useScreenCapture } from '../state/AppContext';
import { MainLayout } from '../layouts/MainLayout';
import { StatusBar } from '../components/viewer';
import { RoomMediaView, ScreenCaptureControls } from '../components/room';
import { Button } from '../components/ui';

export function ViewerPage(): React.JSX.Element {
  const { room, connectionStatus } = useAppState();
  const navigate = useNavigate();
  const socketClient = useSocketClient();
  const screenCapture = useScreenCapture();

  const handleLeaveRoom = (): void => {
    if (room && socketClient) {
      socketClient.leaveRoom(room.code, room.participantId);
    }
    screenCapture?.stopCapture();
    navigate('home');
  };

  if (!room) {
    return (
      <MainLayout showBack title="Visualizador">
        <div className="page page--viewer">
          <p>Nenhuma sala encontrada.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBack title="Visualizador">
      <div className="page page--viewer">
        <div className="viewer-header">
          <h2>Visualizador {room.code}</h2>
          <Button variant="secondary" size="md" onClick={handleLeaveRoom}>
            Sair da sala
          </Button>
        </div>

        <div className="viewer-content">
          <StatusBar
            connectionStatus={connectionStatus}
          />

          <RoomMediaView participants={room.participants} currentUserId={room.participantId} />
          <ScreenCaptureControls />
        </div>
      </div>
    </MainLayout>
  );
}