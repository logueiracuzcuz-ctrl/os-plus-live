/**
 * Application state context.
 * Provides global state management via React Context + useReducer.
 */

import { createContext, useContext, useReducer, useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react';
import type { AppState, AppAction, Toast, ToastType, ModalData, Route, ISocketClient } from '../types';
import { INITIAL_STATE } from '../types';
import { SocketClient } from '../services/socket';
import type { SocketEvent } from '../services/socket';
import { CLIENT_CONFIG } from '@screenshare/shared';
import { createRtcConfiguration, WebRtcManager, type IceEnvironment } from '../services/webrtc';
import { ScreenCaptureService } from '../services/screen';
import type { ScreenCaptureEvent } from '../services/screen';

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, route: action.route };

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };

    case 'SET_ROOM':
      return { ...state, room: action.room };

    case 'UPDATE_PARTICIPANTS':
      if (!state.room) return state;
      return {
        ...state,
        room: { ...state.room, participants: action.participants },
      };

    case 'SET_LOCAL_SHARING':
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === state.room?.participantId
              ? { ...participant, isSharing: action.isSharing }
              : participant,
          ),
        },
      };

    case 'UPDATE_TRANSMISSION':
      return {
        ...state,
        transmission: { ...state.transmission, ...action.settings },
      };

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };

    case 'SHOW_MODAL':
      return { ...state, modal: action.modal };

    case 'HIDE_MODAL':
      return { ...state, modal: null };

    default:
      return state;
  }
}

const StateContext = createContext<AppState>(INITIAL_STATE);
const DispatchContext = createContext<Dispatch<AppAction>>(() => {
  // Initial empty dispatch - will be overridden by provider
});

const SocketContext = createContext<ISocketClient | null>(null);
const WebRtcContext = createContext<WebRtcManager | null>(null);
const ScreenCaptureContext = createContext<ScreenCaptureService | null>(null);

/** Provider component for the application state. */
export function StateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  const [socketClient] = useState(
    () => new SocketClient({
      serverUrl: CLIENT_CONFIG.DEFAULT_SERVER_URL,
      reconnectInterval: CLIENT_CONFIG.RECONNECT_BASE_DELAY_MS,
      maxReconnectAttempts: CLIENT_CONFIG.MAX_RECONNECT_ATTEMPTS,
      connectionTimeout: CLIENT_CONFIG.CONNECTION_TIMEOUT_MS,
    }),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const [webRtcManager] = useState(() => {
    const environment = (import.meta as ImportMeta & { env?: IceEnvironment }).env ?? {};
    return new WebRtcManager(socketClient, {
      rtcConfiguration: createRtcConfiguration(environment),
    });
  });
  const [screenCapture] = useState(() => new ScreenCaptureService());

  useEffect(() => {
    webRtcManager.setLocalParticipant(
      state.room?.code ?? null,
      state.room?.participantId ?? null,
      state.room?.isHost ?? false,
    );
  }, [state.room?.code, state.room?.participantId, state.room?.isHost, webRtcManager]);

  useEffect(() => {
    const handleCaptureEvent = (event: ScreenCaptureEvent): void => {
      if (event.type === 'started') {
        webRtcManager.setLocalStream(event.stream);
        dispatch({ type: 'SET_LOCAL_SHARING', isSharing: true });
      } else if (event.type === 'stopped') {
        webRtcManager.clearLocalStream();
        dispatch({ type: 'SET_LOCAL_SHARING', isSharing: false });
      }
    };
    screenCapture.on(handleCaptureEvent);
    return () => {
      screenCapture.off(handleCaptureEvent);
      screenCapture.dispose();
    };
  }, [dispatch, screenCapture, webRtcManager]);

  useEffect(() => {
    const handleStateChange = (event: SocketEvent): void => {
      if (event.type === 'stateChange') {
        dispatch({ type: 'SET_CONNECTION_STATUS', status: event.payload.state });
      }
    };
    const handleConnected = (event: SocketEvent): void => {
      if (event.type === 'connected') {
        console.log('[AppContext] Connected to server with ID:', event.payload.clientId);
      }
    };
    const handleDisconnected = (event: SocketEvent): void => {
      if (event.type === 'disconnected') {
        console.log('[AppContext] Disconnected from server:', event.payload.reason);
      }
    };
    const handleError = (event: SocketEvent): void => {
      if (event.type === 'error') {
        console.error('[AppContext] Socket error:', event.payload.error);
      }
    };
    const handleRoomCreated = (event: SocketEvent): void => {
      if (event.type === 'roomCreated') {
        console.log('[AppContext] Room created:', event.payload.data);
      }
    };
    const handleRoomJoined = (event: SocketEvent): void => {
      if (event.type === 'roomJoined') {
        console.log('[AppContext] Room joined:', event.payload.data);
      }
    };
    const handleParticipantJoined = (event: SocketEvent): void => {
      if (event.type === 'participantJoined' && stateRef.current.room) {
        const participant = event.payload.data.payload.participant;
        webRtcManager.handleParticipantJoined(participant);
        const participants = [...stateRef.current.room.participants, participant];
        dispatch({ type: 'UPDATE_PARTICIPANTS', participants });
      }
    };
    const handleParticipantLeft = (event: SocketEvent): void => {
      if (event.type === 'participantLeft' && stateRef.current.room) {
        const participantId = event.payload.data.payload.participantId;
        webRtcManager.closePeer(participantId);
        const participants = stateRef.current.room.participants.filter((p) => p.id !== participantId);
        dispatch({ type: 'UPDATE_PARTICIPANTS', participants });
      }
    };
    const handleServerError = (event: SocketEvent): void => {
      if (event.type === 'serverError') {
        console.error('[AppContext] Server error:', event.payload.data);
      }
    };

    socketClient.on('stateChange', handleStateChange);
    socketClient.on('connected', handleConnected);
    socketClient.on('disconnected', handleDisconnected);
    socketClient.on('error', handleError);
    socketClient.on('roomCreated', handleRoomCreated);
    socketClient.on('roomJoined', handleRoomJoined);
    socketClient.on('participantJoined', handleParticipantJoined);
    socketClient.on('participantLeft', handleParticipantLeft);
    socketClient.on('serverError', handleServerError);
    webRtcManager.start();
    socketClient.connect();

    return () => {
      socketClient.off('stateChange', handleStateChange);
      socketClient.off('connected', handleConnected);
      socketClient.off('disconnected', handleDisconnected);
      socketClient.off('error', handleError);
      socketClient.off('roomCreated', handleRoomCreated);
      socketClient.off('roomJoined', handleRoomJoined);
      socketClient.off('participantJoined', handleParticipantJoined);
      socketClient.off('participantLeft', handleParticipantLeft);
      socketClient.off('serverError', handleServerError);
      webRtcManager.dispose();
      socketClient.disconnect();
    };
  }, [dispatch, socketClient, webRtcManager]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        <SocketContext.Provider value={socketClient}>
          <WebRtcContext.Provider value={webRtcManager}>
            <ScreenCaptureContext.Provider value={screenCapture}>{children}</ScreenCaptureContext.Provider>
          </WebRtcContext.Provider>
        </SocketContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

/** Access the full application state. */
export function useAppState(): AppState {
  return useContext(StateContext);
}

/** Access the dispatch function. */
export function useAppDispatch(): Dispatch<AppAction> {
  return useContext(DispatchContext);
}

/** Access the socket client. */
export function useSocketClient(): ISocketClient | null {
  return useContext(SocketContext);
}

/** Access the stable WebRTC peer manager. */
export function useWebRtcManager(): WebRtcManager | null {
  return useContext(WebRtcContext);
}

/** Access the stable screen capture service. */
export function useScreenCapture(): ScreenCaptureService | null {
  return useContext(ScreenCaptureContext);
}

let toastCounter = 0;

/** Convenience hook for navigation. */
export function useNavigate(): (route: Route) => void {
  const dispatch = useAppDispatch();
  return (route: Route) => dispatch({ type: 'NAVIGATE', route });
}

/** Convenience hook for toast notifications. */
export function useToast(): (type: ToastType, message: string, duration?: number) => void {
  const dispatch = useAppDispatch();
  return (type: ToastType, message: string, duration = 4000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const toast: Toast = { id, type, message, duration };
    dispatch({ type: 'ADD_TOAST', toast });

    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', id });
      }, duration);
    }
  };
}

/** Convenience hook for modal dialogs. */
export function useModal(): {
  showModal: (data: Omit<ModalData, 'id'>) => void;
  hideModal: () => void;
} {
  const dispatch = useAppDispatch();
  return {
    showModal: (data) => {
      const id = `modal-${Date.now()}`;
      dispatch({ type: 'SHOW_MODAL', modal: { ...data, id } });
    },
    hideModal: () => dispatch({ type: 'HIDE_MODAL' }),
  };
}
