import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Button, Input } from '../components/ui';
import { MainLayout } from '../layouts/MainLayout';
import { useAppDispatch, useNavigate, useToast, useSocketClient, useAppState } from '../state/AppContext';
import type { RoomData } from '../types';
import type { SocketEvent } from '../services/socket';

export function JoinRoomPage(): React.JSX.Element {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const socketClient = useSocketClient();
  const { connectionStatus } = useAppState();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for room join response
  useEffect(() => {
    if (!socketClient) return;

    const handleRoomJoined = (event: SocketEvent): void => {
      if (event.type === 'roomJoined') {
        // Clear timeout on successful response
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const data = event.payload.data;
        const joinedRoom: RoomData = {
          code: data.payload.roomCode,
          participantId: data.payload.participantId,
          displayName: displayName,
          isHost: false,
          hostId: data.payload.hostId,
          hostDisplayName: data.payload.hostDisplayName,
          participants: data.payload.participants.map((participant) => ({
            id: participant.id,
            displayName: participant.displayName,
            isHost: participant.isHost,
            isSharing: participant.isSharing,
          })),
        };

        dispatch({ type: 'SET_ROOM', room: joinedRoom });
        setLoading(false);
        toast('success', 'Você entrou na sala!');
        navigate('viewer');
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
        toast('error', errorData.payload.message || 'Erro ao entrar na sala');
        if (errorData.payload.code === 'ROOM_NOT_FOUND') {
          setErrors((prev) => ({ ...prev, code: errorData.payload.message }));
        } else if (errorData.payload.code === 'ROOM_FULL') {
          setErrors((prev) => ({ ...prev, code: errorData.payload.message }));
        } else {
          setErrors((prev) => ({ ...prev, code: errorData.payload.message }));
        }
      }
    };

    socketClient.on('roomJoined', handleRoomJoined);
    socketClient.on('serverError', handleServerError);

    return () => {
      socketClient.off('roomJoined', handleRoomJoined);
      socketClient.off('serverError', handleServerError);
    };
  }, [socketClient, displayName, dispatch, toast, navigate]);

  const handleJoin = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const newErrors: { code?: string; name?: string } = {};

    const trimmedCode = code.trim().toUpperCase().replace(/[-\s]/g, '');
    const trimmedName = displayName.trim();

    if (!trimmedCode) {
      newErrors.code = 'Informe o código da sala.';
    } else if (trimmedCode.length !== 6 || !/^[A-Z0-9]+$/.test(trimmedCode)) {
      newErrors.code = 'Código inválido. Use 6 caracteres.';
    }

    if (!trimmedName) {
      newErrors.name = 'Informe seu nome ou apelido.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!socketClient) {
      toast('error', 'Erro de conexão');
      return;
    }

    setErrors({});
    setLoading(true);

    if (!(await socketClient.waitUntilReady())) {
      setLoading(false);
      toast('error', 'Não foi possível conectar ao servidor. Tente novamente.');
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const success = socketClient.joinRoom(trimmedCode, trimmedName);
    if (!success) {
      setLoading(false);
      toast('error', 'A conexão foi perdida antes do envio. Tente novamente.');
      return;
    }

    // Set timeout for server response
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
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

  const handleCodeChange = (value: string): void => {
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
  };

  return (
    <MainLayout showBack title="Entrar em uma sala">
      <div className="page page--form">
        <form className="form" onSubmit={handleJoin} noValidate>
          <Input
            label="Código da sala"
            placeholder="ABC234"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            error={errors.code}
            maxLength={6}
            autoFocus
            autoComplete="off"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
          />
          <Input
            label="Seu nome ou apelido"
            placeholder="Como os outros vão te ver"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
            maxLength={30}
          />
          <Button type="submit" variant="primary" size="lg" loading={loading} disabled={connectionStatus !== 'connected'} fullWidth>
            {loading ? 'Entrando...' : connectionStatus === 'connected' ? 'Entrar' : 'Conectando...'}
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}
