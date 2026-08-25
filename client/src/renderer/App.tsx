import { StateProvider, useAppState } from './state/AppContext';
import { HomePage } from './pages/Home';
import { CreateRoomPage } from './pages/CreateRoom';
import { JoinRoomPage } from './pages/JoinRoom';
import { RoomPage } from './pages/Room';
import { ViewerPage } from './pages/Viewer';

function AppContent(): React.JSX.Element {
  const { route } = useAppState();

  switch (route) {
    case 'home':
      return <HomePage />;

    case 'create-room':
      return <CreateRoomPage />;

    case 'join-room':
      return <JoinRoomPage />;

    case 'room':
      return <RoomPage />;

    case 'viewer':
      return <ViewerPage />;

    default:
      return <HomePage />;
  }
}

export function App(): React.JSX.Element {
  return (
    <StateProvider>
      <AppContent />
    </StateProvider>
  );
}
