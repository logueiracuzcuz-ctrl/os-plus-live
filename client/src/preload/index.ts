/**
 * ScreenShare Electron Preload Script
 *
 * Exposes a safe, limited API from the main process to the renderer
 * using contextBridge. No Node.js globals are leaked to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * API exposed to the renderer process.
 * Only explicitly listed methods are available.
 */
interface ScreenSource {
  id: string;
  name: string;
  type: 'screen' | 'window';
}

const electronAPI = {
  /** Returns the Electron version */
  getVersion: (): string => process.versions.electron ?? 'unknown',
  /** Returns the platform identifier */
  getPlatform: (): string => process.platform,
  /** Lists selectable screens and windows without exposing Electron objects. */
  listScreenSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('screen-capture:list-sources'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

/**
 * Type declaration for the exposed API.
 * Import this type in renderer code via a .d.ts file.
 */
export type ElectronAPI = typeof electronAPI;
