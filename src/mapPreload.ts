import { contextBridge, ipcRenderer } from 'electron';

export interface MapAPI {
  onMapData: (cb: (data: any) => void) => void;
  onPlayerLocation: (cb: (loc: { x: number; y: number; z: number }) => void) => void;
  onZoneChanged: (cb: (zone: string) => void) => void;
  moveMapWindow: (x: number, y: number) => void;
  mapDragStart: (anchorX: number, anchorY: number, screenX: number, screenY: number) => void;
  mapDragEnd: () => void;
  mapResizeStart: (screenX: number, screenY: number) => void;
  mapResizeEnd: () => void;
}

// Buffer the last message per channel so late-registering listeners
// still receive data that arrived before React mounted.
const lastData = new Map<string, any>();
const listeners = new Map<string, (data: any) => void>();

function bufferedChannel<T>(channel: string) {
  ipcRenderer.on(channel, (_, data) => {
    lastData.set(channel, data);
    const cb = listeners.get(channel);
    if (cb) cb(data);
  });

  return (cb: (data: T) => void) => {
    listeners.set(channel, cb);
    // Replay buffered data immediately if it arrived before this listener
    if (lastData.has(channel)) {
      cb(lastData.get(channel));
    }
  };
}

const onMapData = bufferedChannel<any>('map-data');
const onPlayerLocation = bufferedChannel<{ x: number; y: number; z: number }>('player-location');
const onZoneChanged = bufferedChannel<string>('map-zone-changed');

contextBridge.exposeInMainWorld('mapAPI', {
  onMapData,
  onPlayerLocation,
  onZoneChanged,
  moveMapWindow: (x: number, y: number) => {
    ipcRenderer.send('map-move-window', x, y);
  },
  mapDragStart: (anchorX: number, anchorY: number, screenX: number, screenY: number) => {
    ipcRenderer.send('map-drag-start', { anchorX, anchorY, screenX, screenY });
  },
  mapDragEnd: () => {
    ipcRenderer.send('map-drag-end');
  },
  mapResizeStart: (screenX: number, screenY: number) => {
    ipcRenderer.send('map-resize-start', { screenX, screenY });
  },
  mapResizeEnd: () => {
    ipcRenderer.send('map-resize-end');
  },
} satisfies MapAPI);
