import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import MapOverlay from './MapOverlay';
import type { ZoneMap } from './mapParser';

declare global {
  interface Window {
    mapAPI: {
      onMapData: (cb: (data: ZoneMap) => void) => void;
      onPlayerLocation: (cb: (loc: { x: number; y: number; z: number }) => void) => void;
      onZoneChanged: (cb: (zone: string) => void) => void;
      moveMapWindow: (x: number, y: number) => void;
      mapDragStart: (anchorX: number, anchorY: number, screenX: number, screenY: number) => void;
      mapDragEnd: () => void;
      mapResizeStart: (screenX: number, screenY: number) => void;
      mapResizeEnd: () => void;
    };
  }
}

function MapApp() {
  const [mapData, setMapData] = useState<ZoneMap | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [playerLoc, setPlayerLoc] = useState<{ x: number; y: number; z: number } | null>(null);
  const [prevLoc, setPrevLoc] = useState<{ x: number; y: number; z: number } | null>(null);

  const dragging = useRef(false);
  const dragAnchor = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);

  useEffect(() => {
    window.mapAPI.onMapData((data) => {
      setMapData(data);
      setPlayerLoc(null);
      setPrevLoc(null);
    });
    window.mapAPI.onPlayerLocation((loc) => {
      setPlayerLoc(prev => {
        if (prev) setPrevLoc(prev);
        return loc;
      });
    });
    window.mapAPI.onZoneChanged((zone) => {
      setZoneName(zone);
    });
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragAnchor.current = { x: e.clientX, y: e.clientY };
    window.mapAPI.mapDragStart(e.clientX, e.clientY, e.screenX, e.screenY);
    e.preventDefault();
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    window.mapAPI.mapResizeStart(e.screenX, e.screenY);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        window.mapAPI.moveMapWindow(
          e.screenX - dragAnchor.current.x,
          e.screenY - dragAnchor.current.y,
        );
      }
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        window.mapAPI.mapDragEnd();
      }
      if (resizing.current) {
        resizing.current = false;
        window.mapAPI.mapResizeEnd();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <MapOverlay
        mapData={mapData}
        zoneName={zoneName}
        playerLoc={playerLoc}
        prevPlayerLoc={prevLoc}
        onDragStart={onDragStart}
        onResizeStart={onResizeStart}
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<MapApp />);
