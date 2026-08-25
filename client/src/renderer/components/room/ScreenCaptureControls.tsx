import { useEffect, useState } from 'react';
import { useAppState, useScreenCapture } from '../../state/AppContext';
import { Button } from '../ui';
import { TransmissionSettingsPanel } from './TransmissionSettingsPanel';
import type { ScreenCaptureEvent, ScreenSource } from '../../services/screen';

/** Shared capture controls available to every participant in a room. */
export function ScreenCaptureControls(): React.JSX.Element {
  const screenCapture = useScreenCapture();
  const { transmission } = useAppState();
  const isElectron = screenCapture?.getPlatform() === 'electron';
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [isCapturing, setIsCapturing] = useState(() => screenCapture?.isCapturing() ?? false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    if (!screenCapture) return;
    let active = true;
    void screenCapture.listSources().then((availableSources) => {
      if (active) setSources(availableSources);
    }).catch(() => {
      if (active) setCaptureError('Não foi possível listar as fontes de captura.');
    });
    const handleCaptureEvent = (event: ScreenCaptureEvent): void => {
      if (event.type === 'started') {
        setIsCapturing(true);
        setCaptureError(null);
      } else if (event.type === 'stopped') {
        setIsCapturing(false);
      } else {
        setCaptureError(event.error.message);
      }
    };
    screenCapture.on(handleCaptureEvent);
    return () => {
      active = false;
      screenCapture.off(handleCaptureEvent);
    };
  }, [screenCapture]);

  const handleToggleCapture = async (): Promise<void> => {
    if (!screenCapture) return;
    if (isCapturing) {
      screenCapture.stopCapture();
      return;
    }
    try {
      const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? null;
      await screenCapture.startCapture(selectedSource, transmission);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Não foi possível iniciar a captura.');
    }
  };

  return (
    <div className="room-capture-panel">
      <TransmissionSettingsPanel />
      <div className="screen-capture-controls">
        <label htmlFor="screen-source">Fonte de captura</label>
        {isElectron ? (
          <select
            id="screen-source"
            value={selectedSourceId}
            onChange={(event) => setSelectedSourceId(event.target.value)}
            disabled={isCapturing}
          >
            <option value="">Selecionar tela ou janela</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.type === 'screen' ? 'Tela' : 'Janela'}: {source.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="screen-capture-controls__browser-hint">
            O navegador exibirá a seleção de tela, janela ou aba ao iniciar.
          </p>
        )}
        {captureError && <p role="alert">{captureError}</p>}
        <div className="room-content__actions">
          <Button variant="primary" size="lg" onClick={handleToggleCapture} fullWidth>
            {isCapturing ? 'Parar compartilhamento' : 'Iniciar compartilhamento'}
          </Button>
        </div>
      </div>
    </div>
  );
}
