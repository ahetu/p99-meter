import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ZoneMap, MapLine, MapLabel } from './mapParser';

interface Props {
  mapData: ZoneMap | null;
  zoneName: string;
  playerLoc: { x: number; y: number; z: number } | null;
  prevPlayerLoc: { x: number; y: number; z: number } | null;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

const BG_DARK = 'rgba(8, 8, 10, 0.96)';
const BG_LIGHT = 'rgba(235, 222, 200, 0.96)';
const PLAYER_COLOR = '#3deb34';
const PLAYER_GLOW = 'rgba(61, 235, 52, 0.5)';
const PLAYER_RADIUS = 6;
const ARROW_LEN = 18;
const Z_FADE_DISTANCE = 50;
const HARDCODED_MIN_ZOOM = 0.005;
const MAX_ZOOM = 30;

function mapLineColor(line: MapLine, alpha: number, dark: boolean): string {
  let r = line.r, g = line.g, b = line.b;
  if (dark) {
    r = Math.min(255, r + 50);
    g = Math.min(255, g + 50);
    b = Math.min(255, b + 50);
  } else {
    const cap = 90;
    r = Math.min(r, cap);
    g = Math.min(g, cap);
    b = Math.min(b, cap);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

function labelColor(label: MapLabel, alpha: number, dark: boolean): string {
  if (dark) {
    if (label.r === 0 && label.g === 0 && label.b === 0) {
      return `rgba(220,220,220,${alpha})`;
    }
    return `rgba(${Math.min(255, label.r + 40)},${Math.min(255, label.g + 40)},${Math.min(255, label.b + 40)},${alpha})`;
  }
  // Light mode: force all labels very dark for readability on parchment
  if (label.r === 0 && label.g === 0 && label.b === 0) {
    return `rgba(40,30,20,${alpha})`;
  }
  const cap = 70;
  const r = Math.min(label.r, cap);
  const g = Math.min(label.g, cap);
  const b = Math.min(label.b, cap);
  return `rgba(${r},${g},${b},${alpha})`;
}

function zOpacity(lineZ: number, playerZ: number): number {
  const dist = Math.abs(lineZ - playerZ);
  if (dist < Z_FADE_DISTANCE) return 1;
  if (dist < Z_FADE_DISTANCE * 3) {
    return Math.max(0.15, 1 - (dist - Z_FADE_DISTANCE) / (Z_FADE_DISTANCE * 2));
  }
  return 0.15;
}

export default function MapOverlay({ mapData, zoneName, playerLoc, prevPlayerLoc, onDragStart, onResizeStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [centerOnPlayer, setCenterOnPlayer] = useState(true);
  const [containerSize, setContainerSize] = useState({ w: 400, h: 400 });
  const [darkMode, setDarkMode] = useState(true);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const fitZoomRef = useRef(1);

  // Auto-fit when map data or container size changes
  useEffect(() => {
    if (!mapData) return;
    const { bounds } = mapData;
    const mapW = bounds.maxX - bounds.minX;
    const mapH = bounds.maxY - bounds.minY;
    if (mapW === 0 && mapH === 0) return;

    const padding = 20;
    const scaleX = (containerSize.w - padding * 2) / mapW;
    const scaleY = (containerSize.h - padding * 2) / mapH;
    const fitZoom = Math.min(scaleX, scaleY);

    fitZoomRef.current = fitZoom;
    setZoom(fitZoom);
    setPan({
      x: containerSize.w / 2 - (bounds.minX + mapW / 2) * fitZoom,
      y: containerSize.h / 2 - (bounds.minY + mapH / 2) * fitZoom,
    });
  }, [mapData, containerSize]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Center on player when location updates
  useEffect(() => {
    if (!centerOnPlayer || !playerLoc || !mapData) return;
    const mapX = -playerLoc.y;
    const mapY = -playerLoc.x;
    setPan({
      x: containerSize.w / 2 - mapX * zoom,
      y: containerSize.h / 2 - mapY * zoom,
    });
  }, [playerLoc, centerOnPlayer, zoom, containerSize, mapData]);

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerSize.w * dpr;
    canvas.height = containerSize.h * dpr;
    canvas.style.width = `${containerSize.w}px`;
    canvas.style.height = `${containerSize.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bgColor = darkMode ? BG_DARK : BG_LIGHT;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, containerSize.w, containerSize.h);

    if (!mapData) {
      ctx.fillStyle = darkMode ? '#444' : '#998';
      ctx.font = '14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No map data', containerSize.w / 2, containerSize.h / 2);
      return;
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const playerZ = playerLoc?.z ?? 0;
    const hasPlayerZ = playerLoc != null;

    // Draw lines
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lineWidth = Math.max(1, 1.6 / zoom);
    ctx.lineWidth = lineWidth;
    for (const line of mapData.lines) {
      const avgZ = (line.z1 + line.z2) / 2;
      const alpha = hasPlayerZ ? zOpacity(avgZ, playerZ) : 0.85;
      ctx.strokeStyle = mapLineColor(line, alpha, darkMode);
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    }

    // Draw labels with outline for readability
    const fontScale = Math.max(0.6, 1 / zoom);
    ctx.textBaseline = 'middle';
    for (const label of mapData.labels) {
      const alpha = hasPlayerZ ? zOpacity(label.z, playerZ) : 0.85;
      if (alpha < 0.15) continue;
      const baseFontSize = label.size === 'large' ? 13 : 11;
      const bold = label.size === 'large' ? 'bold ' : '';
      ctx.font = `${bold}${baseFontSize * fontScale}px "Segoe UI", Arial, sans-serif`;

      const outlineAlpha = Math.min(1, alpha * 1.2);
      ctx.strokeStyle = darkMode
        ? `rgba(0,0,0,${outlineAlpha})`
        : `rgba(235,222,200,${outlineAlpha})`;
      ctx.lineWidth = darkMode ? Math.max(1.5, 3 / zoom) : Math.max(2.5, 5 / zoom);
      ctx.lineJoin = 'round';
      ctx.strokeText(label.text, label.x, label.y);

      ctx.fillStyle = labelColor(label, alpha, darkMode);
      ctx.fillText(label.text, label.x, label.y);
    }

    // Draw player position
    if (playerLoc) {
      const px = -playerLoc.y;
      const py = -playerLoc.x;
      const r = PLAYER_RADIUS / zoom;

      ctx.shadowColor = PLAYER_GLOW;
      ctx.shadowBlur = 12 / zoom;

      ctx.fillStyle = PLAYER_COLOR;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = PLAYER_COLOR;
      ctx.lineWidth = Math.max(1, 2 / zoom);
      ctx.beginPath();
      ctx.arc(px, py, r * 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      if (prevPlayerLoc) {
        const dx = -playerLoc.y - (-prevPlayerLoc.y);
        const dy = -playerLoc.x - (-prevPlayerLoc.x);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.5) {
          const nx = dx / dist;
          const ny = dy / dist;
          const arrowLen = ARROW_LEN / zoom;
          ctx.shadowColor = PLAYER_GLOW;
          ctx.shadowBlur = 8 / zoom;
          ctx.strokeStyle = PLAYER_COLOR;
          ctx.lineWidth = Math.max(1, 2.5 / zoom);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + nx * arrowLen, py + ny * arrowLen);
          ctx.stroke();

          const headLen = arrowLen * 0.4;
          const angle = Math.atan2(ny, nx);
          ctx.beginPath();
          ctx.moveTo(px + nx * arrowLen, py + ny * arrowLen);
          ctx.lineTo(
            px + nx * arrowLen - headLen * Math.cos(angle - 0.5),
            py + ny * arrowLen - headLen * Math.sin(angle - 0.5),
          );
          ctx.moveTo(px + nx * arrowLen, py + ny * arrowLen);
          ctx.lineTo(
            px + nx * arrowLen - headLen * Math.cos(angle + 0.5),
            py + ny * arrowLen - headLen * Math.sin(angle + 0.5),
          );
          ctx.stroke();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      }
    }

    ctx.restore();
  }, [mapData, pan, zoom, playerLoc, prevPlayerLoc, containerSize, darkMode]);

  // Mouse wheel zoom — uses fitZoom as dynamic minimum
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const effectiveMin = Math.min(HARDCODED_MIN_ZOOM, fitZoomRef.current);
    const newZoom = Math.min(MAX_ZOOM, Math.max(effectiveMin, zoom * factor));
    const mouseX = e.nativeEvent.offsetX;
    const mouseY = e.nativeEvent.offsetY;
    setPan(prev => ({
      x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
      y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
    }));
    setZoom(newZoom);
    if (centerOnPlayer) setCenterOnPlayer(false);
  }, [zoom, centerOnPlayer]);

  // Pan via any mouse button drag on canvas
  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panStartOffset.current = { ...pan };
      if (centerOnPlayer) setCenterOnPlayer(false);
      e.preventDefault();
    }
  }, [pan, centerOnPlayer]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      setPan({
        x: panStartOffset.current.x + (e.clientX - panStart.current.x),
        y: panStartOffset.current.y + (e.clientY - panStart.current.y),
      });
    };
    const onUp = () => { isPanning.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const dark = darkMode;
  const titleBarBg = dark
    ? 'linear-gradient(180deg, #333338 0%, #222226 50%, #1a1a1e 100%)'
    : 'linear-gradient(180deg, #d4c4a8 0%, #c4b090 50%, #b8a480 100%)';
  const titleBorder = dark ? '1px solid rgba(0,0,0,0.6)' : '1px solid rgba(140,120,90,0.5)';
  const titleTextColor = dark ? '#e8dcc8' : '#3a2e1e';
  const subtleTextColor = dark ? '#777' : '#8a7a60';
  const btnInactiveColor = dark ? '#666' : '#9a8a6a';
  const outerBorder = dark ? '1px solid rgba(60,60,60,0.4)' : '1px solid rgba(160,140,100,0.5)';
  const outerBg = dark ? 'rgba(12,12,14,0.94)' : 'rgba(230,218,196,0.96)';
  const gripColor = dark ? '#aaa' : '#8a7a60';

  const coordsText = playerLoc
    ? `${playerLoc.x.toFixed(1)}, ${playerLoc.y.toFixed(1)}, ${playerLoc.z.toFixed(1)}`
    : '';

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: outerBg, borderRadius: 3, overflow: 'hidden',
      border: outerBorder,
      boxShadow: '0 2px 12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Title bar */}
      <div
        onMouseDown={onDragStart}
        style={{
          height: 24, display: 'flex', alignItems: 'center', padding: '0 5px 0 7px', gap: 5,
          background: titleBarBg,
          borderBottom: titleBorder,
          cursor: 'grab', userSelect: 'none', flexShrink: 0,
          fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: 11,
        }}
      >
        <span style={{ opacity: 0.25, fontSize: 9, letterSpacing: 1, color: btnInactiveColor }}>⠿</span>
        <span style={{
          color: titleTextColor, fontWeight: 600, fontSize: 12, letterSpacing: 0.2,
          textShadow: dark ? '0 1px 3px rgba(0,0,0,1)' : '0 1px 0 rgba(255,255,255,0.5)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '45%',
        }}>{zoneName || 'Map'}</span>
        <span style={{ flex: 1 }} />
        {coordsText && (
          <span style={{
            color: subtleTextColor, fontSize: 10, fontFamily: '"Segoe UI Semibold", Arial, sans-serif',
            whiteSpace: 'nowrap', marginRight: 2,
          }}>{coordsText}</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setDarkMode(d => !d); }}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, padding: '0 2px', lineHeight: 1,
            color: dark ? '#aaa' : '#7a6a4a',
            transition: 'color 0.2s',
          }}
        >{dark ? '☀' : '☽'}</button>
        <button
          onClick={(e) => { e.stopPropagation(); setCenterOnPlayer(c => !c); }}
          title={centerOnPlayer ? 'Centered on player (click to free-pan)' : 'Free pan (click to center on player)'}
          style={{
            background: centerOnPlayer ? (dark ? 'rgba(61,235,52,0.15)' : 'rgba(61,235,52,0.2)') : 'none',
            border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px',
            color: centerOnPlayer ? PLAYER_COLOR : btnInactiveColor,
            transition: 'color 0.2s',
          }}
        >◎</button>
      </div>

      {/* Canvas area with resize grip overlay */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onWheel={onWheel}
          onMouseDown={onCanvasMouseDown}
          onContextMenu={e => e.preventDefault()}
          style={{ position: 'absolute', top: 0, left: 0, cursor: isPanning.current ? 'grabbing' : 'crosshair' }}
        />
        <div
          onMouseDown={onResizeStart}
          style={{
            position: 'absolute', bottom: 0, right: 0,
            cursor: 'nwse-resize', padding: '3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" style={{ opacity: 0.4 }}>
            <line x1="11" y1="3" x2="3" y2="11" stroke={gripColor} strokeWidth="1.2" />
            <line x1="11" y1="6" x2="6" y2="11" stroke={gripColor} strokeWidth="1.2" />
            <line x1="11" y1="9" x2="9" y2="11" stroke={gripColor} strokeWidth="1.2" />
          </svg>
        </div>
      </div>
    </div>
  );
}
