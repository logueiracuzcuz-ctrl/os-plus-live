import { ScreenCaptureService } from '../src/renderer/services/screen/ScreenCaptureService';
import type { ScreenCaptureSettings, ScreenSource } from '../src/renderer/services/screen/types';

interface FakeTrack extends Partial<MediaStreamTrack> {
  stopped: boolean;
  onended: (() => void) | null;
}

interface FakeStream extends Partial<MediaStream> {
  getTracks(): MediaStreamTrack[];
  getVideoTracks(): MediaStreamTrack[];
}

const source: ScreenSource = { id: 'screen:1', name: 'Desktop', type: 'screen' };

function createFakeCapture(): { track: FakeTrack; stream: FakeStream } {
  const track: FakeTrack = {
    stopped: false,
    onended: null,
    stop() {
      track.stopped = true;
    },
  };
  const stream: FakeStream = {
    getTracks: () => [track as MediaStreamTrack],
    getVideoTracks: () => [track as MediaStreamTrack],
  };
  return { track, stream };
}

describe('ScreenCaptureService', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  });

  it('applies selected video constraints to the capture request', async () => {
    const capture = createFakeCapture();
    let requestedConstraints: MediaStreamConstraints | undefined;
    const settings: ScreenCaptureSettings = { quality: '720p', frameRate: 60, audio: 'off' };

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { electronAPI: { listScreenSources: async () => [source] } },
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            requestedConstraints = constraints;
            return capture.stream as MediaStream;
          },
        },
      },
    });

    const service = new ScreenCaptureService();
    await service.startCapture(source, settings);

    const videoConstraints = requestedConstraints?.video as { mandatory: Record<string, unknown> };
    expect(videoConstraints.mandatory).toMatchObject({
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: source.id,
      maxWidth: 1280,
      maxHeight: 720,
      maxFrameRate: 60,
    });
    expect(requestedConstraints?.audio).toBe(false);
    service.dispose();
  });

  it('uses browser display capture when Electron APIs are unavailable', async () => {
    const capture = createFakeCapture();
    let requestedConstraints: DisplayMediaStreamOptions | undefined;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getDisplayMedia: async (constraints: DisplayMediaStreamOptions) => {
            requestedConstraints = constraints;
            return capture.stream as MediaStream;
          },
        },
      },
    });

    const service = new ScreenCaptureService();
    const stream = await service.startCapture(null, { quality: '1080p', frameRate: 30, audio: 'off' });

    expect(service.getPlatform()).toBe('browser');
    expect(stream).toBe(capture.stream);
    expect(requestedConstraints?.audio).toBe(false);
    expect(requestedConstraints?.video).toEqual({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
    });
    service.dispose();
  });

  it('lists sources, stores one stream, and stops it when the track ends', async () => {
    const capture = createFakeCapture();
    let getUserMediaCalls = 0;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { electronAPI: { listScreenSources: async () => [source] } },
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async () => {
            getUserMediaCalls++;
            return capture.stream as MediaStream;
          },
        },
      },
    });

    const service = new ScreenCaptureService();
    const events: string[] = [];
    service.on((event) => events.push(event.type));
    expect(await service.listSources()).toEqual([source]);
    const firstStream = await service.startCapture(source);
    const secondStream = await service.startCapture(source);

    expect(firstStream).toBe(capture.stream);
    expect(secondStream).toBe(firstStream);
    expect(getUserMediaCalls).toBe(1);
    expect(service.getStream()).toBe(capture.stream);
    expect(service.isCapturing()).toBe(true);

    capture.track.onended?.();
    expect(capture.track.stopped).toBe(true);
    expect(service.getStream()).toBeNull();
    expect(service.isCapturing()).toBe(false);
    expect(events).toEqual(['started', 'stopped']);
    service.dispose();
  });
});
