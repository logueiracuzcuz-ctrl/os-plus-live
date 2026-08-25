import { useAppState, useAppDispatch, useNavigate, useSocketClient, useScreenCapture } from '../state/AppContext';
import { MainLayout } from '../layouts/MainLayout';
import { RoomCode, ScreenCaptureControls, RoomMediaView } from '../components/room';
import { Button } from '../components/ui';

export function RoomPage(): React.JSX.Element {
  const { room } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const socketClient = useSocketClient();
  const screenCapture = useScreenCapture();

  const handleLeaveRoom = (): void => {
    if (room && socketClient) {
      socketClient.leaveRoom(room.code, room.participantId);
    }
    screenCapture?.stopCapture();
    dispatch({ type: 'SET_ROOM', room: null });
    navigate('home');
  };


  if (!room) {
    return (
      <MainLayout showBack title="Sala">
        <div className="page page--room">
          <p>Nenhuma sala encontrada.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBack title="Sala">
      <div className="page page--room">
        <div className="room-header">
          <div>
            <h2>Sala {room.code}</h2>
            <p className="room-header__subtitle">
              {room.isHost ? 'Você é o host' : 'Você é um participante'}
            </p>
          </div>
          <div className="room-header__actions">
            <RoomCode code={room.code} size="md" />
          </div>
        </div>

        <RoomMediaView participants={room.participants} currentUserId={room.participantId} />

        <div className="room-content">
          <div className="room-content__panel">
            <ScreenCaptureControls />
          </div>
          <div className="room-content__panel room-content__leave-panel">
            <Button variant="secondary" size="lg" onClick={handleLeaveRoom} fullWidth>
              Sair da sala
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}