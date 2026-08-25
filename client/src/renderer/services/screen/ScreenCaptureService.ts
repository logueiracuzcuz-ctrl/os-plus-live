import type {
  ScreenCaptureEvent,
  ScreenCaptureListener,
  ScreenCaptureSettings,
  ScreenCaptureState,
  ScreenSource,
} from './types';

const QUALITY_DIMENSIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
} as const;

function getAudioTracks(stream: MediaStream): MediaStreamTrack[] {
  return typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
}

interface ElectronVideoConstraints extends MediaTrackConstraints {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    maxFrameRate: number;
  };
}

interface ElectronAudioConstraints extends MediaTrackConstraints {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
  };
}

/** Owns the single local screen/window MediaStream for the renderer. */
export class ScreenCaptureService {
  private stream: MediaStream | null = null;
  private source: ScreenSource | null = null;
  private state: ScreenCaptureState = 'idle';
  private readonly listeners = new Set<ScreenCaptureListener>();

  async listSources(): Promise<ScreenSource[]> {
    try {
      if (window.electronAPI?.listScreenSources) {
        return await window.electronAPI.listScreenSources();
      }
      return [];
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      this.emit({ type: 'error', error: normalizedError });
      throw normalizedError;
    }
  }

  async startCapture(
    selectedSource: ScreenSource | null = null,
    settings: ScreenCaptureSettings = { quality: '1080p', frameRate: 30, audio: 'off' },
  ): Promise<MediaStream> {
    if (this.stream) return this.stream;

    const acquiredStreams: MediaStream[] = [];

    try {
      const dimensions = QUALITY_DIMENSIONS[settings.quality];
      const video = selectedSource
        ? {
            mandatory: {
              chromeMediaSource: 'desktop' as const,
              chromeMediaSourceId: selectedSource.id,
              minWidth: 1,
              maxWidth: dimensions.width,
              minHeight: 1,
              maxHeight: dimensions.height,
              maxFrameRate: settings.frameRate,
            },
          } as ElectronVideoConstraints
        : {
            width: { ideal: dimensions.width },
            height: { ideal: dimensions.height },
            frameRate: { ideal: settings.frameRate, max: settings.frameRate },
          };
      // Chromium/Electron supports desktop audio most reliably when it is
      // requested together with the desktop video source. Microphone audio
      // remains a separate request and is combined only when available.
      const wantsMicrophone = settings.audio === 'microphone' || settings.audio === 'both';
      const wantsSystemAudio = (settings.audio === 'system' || settings.audio === 'both') && selectedSource !== null;
      const systemAudioConstraints = selectedSource
        ? {
            mandatory: {
              chromeMediaSource: 'desktop' as const,
              chromeMediaSourceId: selectedSource.id,
            },
          } as ElectronAudioConstraints
        : false;

      let videoStream: MediaStream;
      if (wantsSystemAudio) {
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            audio: systemAudioConstraints,
            video,
          });
        } catch (error) {
          const normalizedError = this.normalizeError(error);
          console.warn(`[ScreenCaptureService] System audio unavailable: ${normalizedError.message}`);
          videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
        }
      } else {
        videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      }
      acquiredStreams.push(videoStream);

      const audioTracks = getAudioTracks(videoStream);
      if (wantsMicrophone) {
        try {
          const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          acquiredStreams.push(microphoneStream);
          audioTracks.push(...getAudioTracks(microphoneStream));
        } catch (error) {
          const normalizedError = this.normalizeError(error);
          console.warn(`[ScreenCaptureService] Microphone unavailable: ${normalizedError.message}`);
        }
      }

      let stream = videoStream;
      const videoAudioTracks = getAudioTracks(videoStream);
      const requiresCombinedStream = audioTracks.length > videoAudioTracks.length;
      if (requiresCombinedStream) {
        try {
          stream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
        } catch (error) {
          const microphoneTracks = audioTracks.filter((track) => !videoAudioTracks.includes(track));
          microphoneTracks.forEach((track) => track.stop());
          const normalizedError = this.normalizeError(error);
          console.warn(`[ScreenCaptureService] Could not combine audio tracks: ${normalizedError.message}`);
        }
      }
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('Screen capture returned no video track');
      }

      this.stream = stream;
      this.source = selectedSource;
      this.state = 'capturing';
      videoTracks.forEach((track) => {
        track.onended = () => this.stopCapture('track-ended');
      });
      this.emit({ type: 'started', stream, source: selectedSource });
      this.logAppliedSettings(stream, settings);
      console.log('[ScreenCaptureService] Capture started');
      return stream;
    } catch (error) {
      acquiredStreams.forEach((acquiredStream) => {
        acquiredStream.getTracks().forEach((track) => track.stop());
      });
      const normalizedError = this.normalizeError(error);
      this.emit({ type: 'error', error: normalizedError });
      throw normalizedError;
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getSource(): ScreenSource | null {
    return this.source;
  }

  getState(): ScreenCaptureState {
    return this.state;
  }

  isCapturing(): boolean {
    return this.stream !== null;
  }

  stopCapture(reason: 'user' | 'track-ended' | 'replaced' = 'user'): void {
    const stream = this.stream;
    if (!stream) return;

    stream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    this.source = null;
    this.state = 'idle';
    this.emit({ type: 'stopped', reason });
    console.log(`[ScreenCaptureService] Capture stopped (${reason})`);
  }

  on(listener: ScreenCaptureListener): void {
    this.listeners.add(listener);
  }

  off(listener: ScreenCaptureListener): void {
    this.listeners.delete(listener);
  }

  dispose(): void {
    this.stopCapture('user');
    this.listeners.clear();
  }

  private emit(event: ScreenCaptureEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  private logAppliedSettings(stream: MediaStream, requested: ScreenCaptureSettings): void {
    const videoTrack = stream.getVideoTracks()[0];
    const videoSettings = videoTrack && typeof videoTrack.getSettings === 'function'
      ? videoTrack.getSettings()
      : null;
    const audioTracks = getAudioTracks(stream);
    console.info('[ScreenCaptureService] Capture settings', {
      requested,
      applied: {
        width: videoSettings?.width,
        height: videoSettings?.height,
        frameRate: videoSettings?.frameRate,
        audioTracks: audioTracks.length,
      },
    });
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
