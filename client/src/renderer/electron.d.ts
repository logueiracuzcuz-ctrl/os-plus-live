/**
 * Type declarations for the Electron preload API exposed to the renderer.
 */

interface ElectronAPI {
  getVersion(): string;
  getPlatform(): string;
  listScreenSources(): Promise<ScreenSource[]>;
}

interface ScreenSource {
  id: string;
  name: string;
  type: 'screen' | 'window';
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
