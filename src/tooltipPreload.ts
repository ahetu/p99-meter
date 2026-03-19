import { contextBridge, ipcRenderer } from 'electron';

export interface TooltipAPI {
  onData: (cb: (data: any) => void) => void;
  onHide: (cb: () => void) => void;
}

contextBridge.exposeInMainWorld('tooltipAPI', {
  onData: (cb: (data: any) => void) => {
    ipcRenderer.removeAllListeners('tooltip-data');
    ipcRenderer.on('tooltip-data', (_, data) => cb(data));
  },
  onHide: (cb: () => void) => {
    ipcRenderer.removeAllListeners('tooltip-hide');
    ipcRenderer.on('tooltip-hide', () => cb());
  },
});
