import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Button, Input } from '../components/ui';
import { RoomCode } from '../components/room/RoomCode';
import { MainLayout } from '../layouts/MainLayout';
import { useAppDispatch, useNavigate, useToast, useSocketClient, useAppState } from '../state/AppContext';
import type { RoomData } from '../types';
import type { SocketEvent } from '../services/socket';

export function CreateRoomPage(): React.JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('20');
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const socketClient = useSocketClient();
  const { connectionStatus } = useAppState();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for room creation response
  useEffect(() => {
    if (!socketClient) return;

    const handleRoomCreated = (event: SocketEvent): void => {
      if (event.type === 'roomCreated') {
        // Clear timeout on successful response
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const data = event.payload.data;
        const newRoom: RoomData = {
          code: data.payload.roomCode,
          participantId: data.payload.participantId,
          displayName: displayName,
          isHost: true,
          hostId: data.payload.participantId,
          hostDisplayName: displayName,
          participants: [
            {
              id: data.payload.participantId,
              displayName: displayName,
              isHost: true,
              isSharing: false,
            },
          ],
        };

        dispatch({ type: 'SET_ROOM', room: newRoom });
        setRoom(newRoom);
        setLoading(false);
        toast('success', 'Sala criada com sucesso!');
      }
    };

    const handleServerError = (event: SocketEvent): void => {
      if (event.type === 'serverError') {
        // Clear timeout on error response
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        setLoading(false);
        const errorData = event.payload.data;
        toast('error', errorData.payload.message || 'Erro ao criar sala');
        setError(errorData.payload.message || 'Erro ao criar sala');
      }
    };

    socketClient.on('roomCreated', handleRoomCreated);
    socketClient.on('serverError', handleServerError);

    return () => {
      socketClient.off('roomCreated', handleRoomCreated);
      socketClient.off('serverError', handleServerError);
    };
  }, [socketClient, displayName, dispatch, toast]);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    const name = displayName.trim();
    if (!name) {
      setError('Informe seu nome ou apelido.');
      return;
    }

    if (!socketClient) {
      setError('Cliente não disponível');
      toast('error', 'Erro de conexão');
      return;
    }

    setLoading(true);

    if (!(await socketClient.waitUntilReady())) {
      setLoading(false);
      setError('Não foi possível conectar ao servidor. Tente novamente.');
      toast('error', 'Não foi possível conectar ao servidor. Tente novamente.');
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const success = socketClient.createRoom(name);
    if (!success) {
      setLoading(false);
      setError('A conexão foi perdida antes do envio. Tente novamente.');
      toast('error', 'A conexão foi perdida antes do envio. Tente novamente.');
      return;
    }

    // Set timeout for server response
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Tempo de resposta excedido');
      toast('error', 'Tempo de resposta do servidor excedido');
    }, 10000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleEnterRoom = (): void => {
    navigate('room');
  };

  if (room) {
    return (
      <MainLayout showBack title="Sala criada">
        <div className="page page--created">
          <div className="created-room">
            <p className="created-room__label">Seu código da sala</p>
            <RoomCode code={room.code} size="lg" />
            <p className="created-room__hint">
              Compartilhe este código com quem você quer que entre na sala.
            </p>
            <div className="created-room__actions">
              <Button variant="primary" size="lg" onClick={handleEnterRoom} fullWidth>
                Entrar na sala
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBack title="Criar sala">
      <div className="page page--form">
        <form className="form" onSubmit={handleCreate} noValidate>
          <Input
            label="Seu nome ou apelido"
            placeholder="Como os outros vão te ver"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={error || undefined}
            maxLength={30}
            autoFocus
          />
          <Input
            label="Limite de participantes"
            type="number"
            min={2}
            max={20}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          />
          <Button type="submit" variant="primary" size="lg" loading={loading} disabled={connectionStatus !== 'connected'} fullWidth>
            {loading ? 'Criando sala...' : connectionStatus === 'connected' ? 'Criar sala' : 'Conectando...'}
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}
