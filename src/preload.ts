import { contextBridge, ipcRenderer } from 'electron';
import type { CombatEvent } from './logParser';

export interface ElectronAPI {
  onCombatEvents: (cb: (events: CombatEvent[]) => void) => void;
  onLogStatus: (cb: (status: { attached: boolean; character?: string; logFile?: string }) => void) => void;
  onReset: (cb: () => void) => void;
  onClassDb: (cb: (db: Record<string, string>) => void) => void;
  onSpellDb: (cb: (db: Record<string, { baseDmg: number; maxDmg: number; castMs: number; calc: number; minLevel: number }>) => void) => void;
  onLandingMap: (cb: (map: Record<string, Array<{ spellName: string; baseDmg: number; maxDmg: number; castMs: number; calc: number; minLevel: number }>>) => void) => void;
  requestStatus: () => void;
  saveClass: (name: string, cls: string) => void;
  moveWindow: (x: number, y: number) => void;
  dragStart: (anchorX: number, anchorY: number, screenX: number, screenY: number) => void;
  dragEnd: () => void;
  startResize: (screenX: number, screenY: number) => void;
  stopResize: () => void;
  stopDragResize: () => void;
  showTooltip: (data: { player: any; viewMode: string; barTop: number; barBottom: number }) => void;
  hideTooltip: () => void;
}

function singleListener<T>(channel: string, cb: (data: T) => void) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (_, data) => cb(data));
}

const api: ElectronAPI = {
  onCombatEvents: (cb: (events: CombatEvent[]) => void) => {
    singleListener('combat-events', cb);
  },
  onLogStatus: (cb: (status: { attached: boolean; character?: string; logFile?: string }) => void) => {
    singleListener('log-status', cb);
  },
  onReset: (cb: () => void) => {
    ipcRenderer.removeAllListeners('reset');
    ipcRenderer.on('reset', () => cb());
  },
  onClassDb: (cb: (db: Record<string, string>) => void) => {
    singleListener('class-db', cb);
  },
  onSpellDb: (cb: (db: Record<string, { baseDmg: number; maxDmg: number; castMs: number; calc: number; minLevel: number }>) => void) => {
    singleListener('spell-db', cb);
  },
  onLandingMap: (cb: (map: Record<string, Array<{ spellName: string; baseDmg: number; maxDmg: number; castMs: number; calc: number; minLevel: number }>>) => void) => {
    singleListener('landing-map', cb);
  },
  requestStatus: () => {
    ipcRenderer.send('request-status');
  },
  saveClass: (name: string, cls: string) => {
    ipcRenderer.send('save-class', { name, cls });
  },
  moveWindow: (x: number, y: number) => {
    ipcRenderer.send('move-window', x, y);
  },
  dragStart: (anchorX: number, anchorY: number, screenX: number, screenY: number) => {
    ipcRenderer.send('drag-start', { anchorX, anchorY, screenX, screenY });
  },
  dragEnd: () => {
    ipcRenderer.send('drag-end');
  },
  startResize: (screenX: number, screenY: number) => {
    ipcRenderer.send('start-resize', { screenX, screenY });
  },
  stopResize: () => {
    ipcRenderer.send('stop-resize');
  },
  stopDragResize: () => {
    ipcRenderer.send('stop-drag-resize');
  },
  showTooltip: (data: { player: any; viewMode: string; barTop: number; barBottom: number }) => {
    ipcRenderer.send('show-tooltip', data);
  },
  hideTooltip: () => {
    ipcRenderer.send('hide-tooltip');
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
