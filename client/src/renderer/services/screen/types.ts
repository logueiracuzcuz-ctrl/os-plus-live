export interface ScreenSource {
  id: string;
  name: string;
  type: 'screen' | 'window';
}

import type { AudioSource, FrameRate, VideoQuality } from '../../types';

export interface ScreenCaptureSettings {
  quality: VideoQuality;
  frameRate: FrameRate;
  audio: AudioSource;
}

export type ScreenCapturePlatform = 'electron' | 'browser';

export type ScreenCaptureState = 'idle' | 'capturing';

export type ScreenCaptureEvent =
  | { type: 'started'; stream: MediaStream; source: ScreenSource | null }
  | { type: 'stopped'; reason: 'user' | 'track-ended' | 'replaced' }
  | { type: 'error'; error: Error };

export type ScreenCaptureListener = (event: ScreenCaptureEvent) => void;
