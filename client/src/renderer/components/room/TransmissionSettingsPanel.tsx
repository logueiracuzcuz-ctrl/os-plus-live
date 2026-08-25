import { useAppState, useAppDispatch } from '../../state/AppContext';
import type { VideoQuality, FrameRate, AudioSource } from '../../types';

const qualityOptions: { value: VideoQuality; label: string }[] = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

const fpsOptions: { value: FrameRate; label: string }[] = [
  { value: 30, label: '30 FPS' },
  { value: 60, label: '60 FPS' },
];

const audioOptions: { value: AudioSource; label: string }[] = [
  { value: 'off', label: 'Desativado' },
  { value: 'microphone', label: 'Microfone' },
  { value: 'system', label: 'Áudio do sistema' },
  { value: 'both', label: 'Ambos' },
];

export function TransmissionSettingsPanel(): React.JSX.Element {
  const { transmission } = useAppState();
  const dispatch = useAppDispatch();

  const update = (settings: Record<string, VideoQuality | FrameRate | AudioSource>): void => {
    dispatch({ type: 'UPDATE_TRANSMISSION', settings });
  };

  return (
    <div className="transmission-settings" role="group" aria-label="Configurações de transmissão">
      <div className="transmission-settings__group">
        <span className="transmission-settings__label">Qualidade</span>
        <div className="transmission-settings__options" role="radiogroup" aria-label="Qualidade de vídeo">
          {qualityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={transmission.quality === opt.value}
              className={`transmission-settings__option ${transmission.quality === opt.value ? 'transmission-settings__option--active' : ''}`}
              onClick={() => update({ quality: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="transmission-settings__group">
        <span className="transmission-settings__label">FPS</span>
        <div className="transmission-settings__options" role="radiogroup" aria-label="Taxa de quadros">
          {fpsOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={transmission.frameRate === opt.value}
              className={`transmission-settings__option ${transmission.frameRate === opt.value ? 'transmission-settings__option--active' : ''}`}
              onClick={() => update({ frameRate: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="transmission-settings__group">
        <span className="transmission-settings__label">Áudio</span>
        <div className="transmission-settings__options" role="radiogroup" aria-label="Fonte de áudio">
          {audioOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={transmission.audio === opt.value}
              className={`transmission-settings__option ${transmission.audio === opt.value ? 'transmission-settings__option--active' : ''}`}
              onClick={() => update({ audio: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
