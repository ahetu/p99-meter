import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipContent } from './TooltipContent';
import type { DisplayPlayer, ViewMode } from './useCombatTracker';

declare global {
  interface Window {
    tooltipAPI: {
      onData: (cb: (data: { player: DisplayPlayer; viewMode: ViewMode; anchor: 'top' | 'bottom' }) => void) => void;
      onHide: (cb: () => void) => void;
    };
  }
}

interface TooltipData {
  player: DisplayPlayer;
  viewMode: ViewMode;
  anchor: 'top' | 'bottom';
}

function TooltipApp() {
  const [data, setData] = useState<TooltipData | null>(null);

  useEffect(() => {
    window.tooltipAPI.onData((d) => setData(d));
    window.tooltipAPI.onHide(() => setData(null));
  }, []);

  if (!data) return null;

  const { player, viewMode, anchor } = data;

  const posStyle: React.CSSProperties = anchor === 'bottom'
    ? { position: 'fixed', bottom: 0, left: 6, right: 6 }
    : { position: 'fixed', top: 0, left: 6, right: 6 };

  return (
    <div style={{
      ...posStyle,
      boxSizing: 'border-box',
      background: 'rgba(16,16,18,0.97)',
      border: '1px solid #444',
      borderLeft: `3px solid ${player.color}`,
      borderRadius: 3,
      padding: '8px 10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.9)',
      fontSize: 12,
      fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif',
    }}>
      <TooltipContent player={player} viewMode={viewMode} />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(React.createElement(TooltipApp));
