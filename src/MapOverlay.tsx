import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ZoneMap, MapLine, MapLabel, FloorInfo, LabelCategory } from './mapParser';
import { Search, X, SunMedium, MoonStar, Crosshair, ChevronUp, ChevronDown, Minus, Plus, Type, Layers } from 'lucide-react';

export interface MapSettingsState {
  darkMode?: boolean;
  centerOnPlayer?: boolean;
  zoomCache?: Record<string, { zoom: number; panX: number; panY: number }>;
}

interface Props {
  mapData: ZoneMap | null;
  zoneName: string;
  playerLoc: { x: number; y: number; z: number } | null;
  prevPlayerLoc: { x: number; y: number; z: number } | null;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onClose?: () => void;
  initialSettings?: MapSettingsState;
  onSaveSettings?: (settings: MapSettingsState) => void;
}

const BG_DARK = '#08080a';
const BG_LIGHT = '#ebdec8';
const PLAYER_COLOR = '#3deb34';
const PLAYER_GLOW = 'rgba(61, 235, 52, 0.5)';
const PLAYER_RADIUS = 6;
const ARROW_LEN = 18;
const Z_FADE_DISTANCE = 50;
const HARDCODED_MIN_ZOOM = 0.005;
const MAX_ZOOM = 30;

type LabelMode = 'all' | 'nav' | 'off';
const LABEL_MODE_ORDER: LabelMode[] = ['all', 'nav', 'off'];
const LABEL_MODE_LABELS: Record<LabelMode, string> = { all: 'All', nav: 'Nav', off: 'Off' };
const NAV_CATEGORIES = new Set<LabelCategory>(['zone', 'landmark']);
const HIDDEN_CATEGORIES = new Set<LabelCategory>(['noise', 'nonp99']);

const ALPHA_LEVELS = [0.05, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0];

function quantizeAlpha(a: number): number {
  for (let i = 0; i < ALPHA_LEVELS.length; i++) {
    if (a <= ALPHA_LEVELS[i] + 0.075) return ALPHA_LEVELS[i];
  }
  return 1.0;
}

function adjustLineRGB(r: number, g: number, b: number, dark: boolean): [number, number, number] {
  if (dark) return [Math.min(255, r + 50), Math.min(255, g + 50), Math.min(255, b + 50)];
  const cap = 90;
  return [Math.min(r, cap), Math.min(g, cap), Math.min(b, cap)];
}

function labelColor(label: MapLabel, alpha: number, dark: boolean): string {
  if (dark) {
    if (label.r === 0 && label.g === 0 && label.b === 0) {
      return `rgba(220,220,220,${alpha})`;
    }
    return `rgba(${Math.min(255, label.r + 40)},${Math.min(255, label.g + 40)},${Math.min(255, label.b + 40)},${alpha})`;
  }
  if (label.r === 0 && label.g === 0 && label.b === 0) {
    return `rgba(40,30,20,${alpha})`;
  }
  const cap = 70;
  return `rgba(${Math.min(label.r, cap)},${Math.min(label.g, cap)},${Math.min(label.b, cap)},${alpha})`;
}

function zOpacityDefault(lineZ: number, playerZ: number): number {
  const dist = Math.abs(lineZ - playerZ);
  if (dist < Z_FADE_DISTANCE) return 1;
  if (dist < Z_FADE_DISTANCE * 3) {
    return Math.max(0.15, 1 - (dist - Z_FADE_DISTANCE) / (Z_FADE_DISTANCE * 2));
  }
  return 0.15;
}

function zOpacityFloor(lineZ: number, floor: FloorInfo | null): number {
  if (!floor) return 0.85;
  if (lineZ >= floor.zMin && lineZ <= floor.zMax) return 1;
  return 0.05;
}

function zOpacityWindow(lineZ: number, playerZ: number, halfWindow: number): number {
  const dist = Math.abs(lineZ - playerZ);
  if (dist < halfWindow * 0.7) return 1;
  if (dist < halfWindow) {
    const t = (dist - halfWindow * 0.7) / (halfWindow * 0.3);
    return Math.max(0.05, 1 - t * t);
  }
  return 0.05;
}

function TitleBtn({ onClick, title, dark, children, active, activeColor, isClose, compact }: {
  onClick: () => void; title: string; dark: boolean; children: React.ReactNode;
  active?: boolean; activeColor?: string; isClose?: boolean; compact?: boolean;
}) {
  const base = dark ? '#999' : '#7a6a4a';
  const hover = isClose ? '#e44' : (dark ? '#ddd' : '#3a2e1e');
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        background: active ? (activeColor ?? 'none') : 'none',
        border: 'none', cursor: 'pointer',
        width: compact ? 22 : 26, height: compact ? 22 : 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 3, color: active ? hover : base,
        transition: 'color 0.15s, background 0.15s',
        padding: 0, flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = hover; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = active ? hover : base; e.currentTarget.style.background = active ? (activeColor ?? 'none') : 'none'; }}
    >{children}</button>
  );
}

export default function MapOverlay({ mapData, zoneName, playerLoc, prevPlayerLoc, onDragStart, onResizeStart, onClose, initialSettings, onSaveSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [centerOnPlayer, setCenterOnPlayer] = useState(initialSettings?.centerOnPlayer ?? true);
  const [containerSize, setContainerSize] = useState({ w: 400, h: 400 });
  const [darkMode, setDarkMode] = useState(initialSettings?.darkMode ?? true);

  const settingsApplied = useRef(false);

  // Apply initial settings once when they arrive (may come after first render)
  useEffect(() => {
    if (!initialSettings || settingsApplied.current) return;
    settingsApplied.current = true;
    if (initialSettings.darkMode != null) setDarkMode(initialSettings.darkMode);
  }, [initialSettings]);

  // Save dark mode / center-on-player when toggled
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onSaveSettings || !settingsApplied.current) return;
    onSaveSettings({ darkMode, centerOnPlayer });
  }, [darkMode, centerOnPlayer]);

  // Save zoom/pan per zone (debounced)
  useEffect(() => {
    if (!onSaveSettings || !zoneName) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSaveSettings({ zoomCache: { [zoneName]: { zoom, panX: pan.x, panY: pan.y } } });
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [zoom, pan, zoneName]);

  // Restore zoom/pan when zone changes
  useEffect(() => {
    if (!initialSettings?.zoomCache || !zoneName) return;
    const cached = initialSettings.zoomCache[zoneName];
    if (cached) {
      setZoom(cached.zoom);
      setPan({ x: cached.panX, y: cached.panY });
    }
  }, [zoneName]);

  // Label filtering (default to Nav -- zone exits + landmarks only)
  const [labelMode, setLabelMode] = useState<LabelMode>('nav');

  // Floor layer state
  const [selectedFloorIdx, setSelectedFloorIdx] = useState<number | null>(null);
  const [zWindowHalf, setZWindowHalf] = useState(130);
  const [showAllFloors, setShowAllFloors] = useState(false);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchMatches = React.useMemo(() => {
    if (!searchQuery || !mapData) return [];
    const q = searchQuery.toLowerCase().replace(/_/g, ' ');
    const matches: number[] = [];
    for (let i = 0; i < mapData.labels.length; i++) {
      const label = mapData.labels[i];
      if (HIDDEN_CATEGORIES.has(label.category)) continue;
      if (labelMode === 'off') continue;
      if (labelMode === 'nav' && !NAV_CATEGORIES.has(label.category)) continue;
      if (label.text.toLowerCase().includes(q)) matches.push(i);
    }
    return matches;
  }, [searchQuery, mapData, labelMode]);

  const searchMatchSet = React.useMemo(() => new Set(searchMatches), [searchMatches]);

  const panToLabel = useCallback((labelIdx: number) => {
    if (!mapData) return;
    const label = mapData.labels[labelIdx];
    if (!label) return;
    setPan({
      x: containerSize.w / 2 - label.x * zoom,
      y: containerSize.h / 2 - label.y * zoom,
    });
    if (centerOnPlayer) setCenterOnPlayer(false);
  }, [mapData, zoom, containerSize, centerOnPlayer]);

  const cycleSearchResult = useCallback((dir: 1 | -1) => {
    if (searchMatches.length === 0) return;
    const next = (searchMatchIdx + dir + searchMatches.length) % searchMatches.length;
    setSearchMatchIdx(next);
    panToLabel(searchMatches[next]);
  }, [searchMatches, searchMatchIdx, panToLabel]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Reset search on zone change
  useEffect(() => {
    setSearchQuery('');
    setSearchOpen(false);
    setSearchMatchIdx(0);
  }, [mapData]);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const fitZoomRef = useRef(1);

  // Auto-select floor from player z
  useEffect(() => {
    if (!mapData || mapData.zMode !== 'floors' || !playerLoc || showAllFloors) return;
    const pz = playerLoc.z;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < mapData.floors.length; i++) {
      const d = Math.abs(pz - mapData.floors[i].zCenter);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (centerOnPlayer) setSelectedFloorIdx(bestIdx);
  }, [playerLoc, mapData, centerOnPlayer, showAllFloors]);

  // Reset floor state on zone change
  useEffect(() => {
    setSelectedFloorIdx(null);
    setShowAllFloors(false);
  }, [mapData]);

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

  // Observe container size (rounded to avoid subpixel jitter redraws)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      const h = Math.round(entries[0].contentRect.height);
      setContainerSize(prev => (prev.w === w && prev.h === h) ? prev : { w, h });
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

  const lastCanvasSize = useRef({ w: 0, h: 0, dpr: 0 });

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = containerSize.w, ch = containerSize.h;

    // Only resize canvas buffer when dimensions actually change
    if (lastCanvasSize.current.w !== cw || lastCanvasSize.current.h !== ch || lastCanvasSize.current.dpr !== dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      lastCanvasSize.current = { w: cw, h: ch, dpr };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bgColor = darkMode ? BG_DARK : BG_LIGHT;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    if (!mapData) {
      ctx.fillStyle = darkMode ? '#444' : '#998';
      ctx.font = '14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No map data', cw / 2, ch / 2);
      return;
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const playerZ = playerLoc?.z ?? 0;
    const hasPlayerZ = playerLoc != null;
    const zMode = mapData.zMode;
    const activeFloor = (zMode === 'floors' && selectedFloorIdx != null && !showAllFloors)
      ? mapData.floors[selectedFloorIdx] ?? null : null;

    const getAlpha = (z: number): number => {
      if (zMode === 'flat') return 1;
      if (!hasPlayerZ) return 0.85;
      if (zMode === 'floors' && !showAllFloors) return zOpacityFloor(z, activeFloor);
      if (zMode === 'window') return zOpacityWindow(z, playerZ, zWindowHalf);
      return zOpacityDefault(z, playerZ);
    };

    // Compute visible map-space rect for viewport culling
    const viewMinX = -pan.x / zoom;
    const viewMinY = -pan.y / zoom;
    const viewMaxX = (cw - pan.x) / zoom;
    const viewMaxY = (ch - pan.y) / zoom;

    // Batch lines by color key (r,g,b,quantized alpha)
    const buckets = new Map<string, MapLine[]>();
    for (const line of mapData.lines) {
      // Viewport culling
      const lMinX = Math.min(line.x1, line.x2);
      const lMaxX = Math.max(line.x1, line.x2);
      const lMinY = Math.min(line.y1, line.y2);
      const lMaxY = Math.max(line.y1, line.y2);
      if (lMaxX < viewMinX || lMinX > viewMaxX || lMaxY < viewMinY || lMinY > viewMaxY) continue;

      const avgZ = (line.z1 + line.z2) / 2;
      const rawAlpha = getAlpha(avgZ);
      const alpha = quantizeAlpha(rawAlpha);
      const [r, g, b] = adjustLineRGB(line.r, line.g, line.b, darkMode);
      const key = `${r},${g},${b},${alpha}`;

      let bucket = buckets.get(key);
      if (!bucket) { bucket = []; buckets.set(key, bucket); }
      bucket.push(line);
    }

    // Draw batched lines
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lineWidth = Math.max(1, 1.6 / zoom);
    ctx.lineWidth = lineWidth;
    for (const [key, lines] of buckets) {
      ctx.strokeStyle = `rgba(${key})`;
      ctx.beginPath();
      for (const line of lines) {
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
      }
      ctx.stroke();
    }

    // Draw labels with outline for readability
    const fontScale = Math.max(0.6, 1 / zoom);
    ctx.textBaseline = 'middle';
    const hasSearch = searchQuery.length > 0;
    for (let li = 0; li < mapData.labels.length; li++) {
      const label = mapData.labels[li];

      // Category filtering: always hide noise/nonp99, then apply label mode
      if (HIDDEN_CATEGORIES.has(label.category)) continue;
      if (labelMode === 'off') continue;
      if (labelMode === 'nav' && !NAV_CATEGORIES.has(label.category)) continue;

      if (label.x < viewMinX || label.x > viewMaxX || label.y < viewMinY || label.y > viewMaxY) continue;

      const rawAlpha = getAlpha(label.z);
      let alpha = quantizeAlpha(rawAlpha);
      if (alpha <= 0.05) continue;

      const isMatch = hasSearch && searchMatchSet.has(li);
      if (hasSearch && !isMatch) alpha = Math.min(alpha, 0.15);

      const baseFontSize = label.size === 'large' ? 13 : 11;
      const bold = label.size === 'large' ? 'bold ' : '';
      ctx.font = `${bold}${baseFontSize * fontScale}px "Segoe UI", Arial, sans-serif`;

      if (isMatch) {
        ctx.shadowColor = 'rgba(255,220,50,0.7)';
        ctx.shadowBlur = 8 / zoom;
      }

      const outlineAlpha = Math.min(1, alpha * 1.2);
      ctx.strokeStyle = darkMode
        ? `rgba(0,0,0,${outlineAlpha})`
        : `rgba(235,222,200,${outlineAlpha})`;
      ctx.lineWidth = darkMode ? Math.max(1.5, 3 / zoom) : Math.max(2.5, 5 / zoom);
      ctx.lineJoin = 'round';
      ctx.strokeText(label.text, label.x, label.y);

      ctx.fillStyle = labelColor(label, alpha, darkMode);
      ctx.fillText(label.text, label.x, label.y);

      if (isMatch) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
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
        const dx = prevPlayerLoc.y - playerLoc.y;
        const dy = prevPlayerLoc.x - playerLoc.x;
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
  }, [mapData, pan, zoom, playerLoc, prevPlayerLoc, containerSize, darkMode, selectedFloorIdx, showAllFloors, zWindowHalf, searchQuery, searchMatchSet, labelMode]);

  // Mouse wheel zoom — uses fitZoom as dynamic minimum
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const effectiveMin = Math.min(HARDCODED_MIN_ZOOM, fitZoomRef.current);
    const newZoom = Math.min(MAX_ZOOM, Math.max(effectiveMin, zoom * factor));

    if (centerOnPlayer && playerLoc) {
      const mapX = -playerLoc.y;
      const mapY = -playerLoc.x;
      setPan({
        x: containerSize.w / 2 - mapX * newZoom,
        y: containerSize.h / 2 - mapY * newZoom,
      });
    } else {
      const mouseX = e.nativeEvent.offsetX;
      const mouseY = e.nativeEvent.offsetY;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
      }));
    }
    setZoom(newZoom);
  }, [zoom, centerOnPlayer, playerLoc, containerSize]);

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
  const outerBg = dark ? '#0c0c0e' : '#e6dac4';
  const gripColor = dark ? '#aaa' : '#8a7a60';

  const coordsText = playerLoc
    ? `${Math.round(playerLoc.x)}, ${Math.round(playerLoc.y)}, ${Math.round(playerLoc.z)}`
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
          height: 28, display: 'flex', alignItems: 'center', padding: '0 4px 0 7px', gap: 2,
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
          maxWidth: '40%', marginRight: 4,
        }}>{zoneName || 'Map'}</span>
        {coordsText && (
          <span style={{
            color: subtleTextColor, fontSize: 10, fontFamily: '"Segoe UI Semibold", Arial, sans-serif',
            whiteSpace: 'nowrap',
          }}>{coordsText}</span>
        )}
        <span style={{ flex: 1 }} />
        {/* Floor picker for stacked-floor dungeons */}
        {mapData?.zMode === 'floors' && mapData.floors.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <Layers size={12} strokeWidth={2} color={subtleTextColor} style={{ marginRight: 2, flexShrink: 0 }} />
            <TitleBtn onClick={() => {
              if (showAllFloors) { setShowAllFloors(false); setSelectedFloorIdx(0); }
              else setSelectedFloorIdx(i => Math.max(0, (i ?? 1) - 1));
            }} title="Floor down" dark={dark}>
              <ChevronDown size={14} strokeWidth={2.5} />
            </TitleBtn>
            <span
              onClick={(e) => { e.stopPropagation(); setShowAllFloors(a => !a); }}
              title={showAllFloors ? 'Click to select a floor' : 'Click to show all floors'}
              style={{
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                color: showAllFloors ? subtleTextColor : titleTextColor,
                minWidth: 32, textAlign: 'center', lineHeight: '28px',
              }}
            >{showAllFloors ? 'All' : `F${(selectedFloorIdx ?? 0) + 1}/${mapData.floors.length}`}</span>
            <TitleBtn onClick={() => {
              if (showAllFloors) { setShowAllFloors(false); setSelectedFloorIdx(0); }
              else setSelectedFloorIdx(i => Math.min(mapData!.floors.length - 1, (i ?? 0) + 1));
            }} title="Floor up" dark={dark}>
              <ChevronUp size={14} strokeWidth={2.5} />
            </TitleBtn>
          </span>
        )}
        {/* Z-window controls for continuous multi-level dungeons */}
        {mapData?.zMode === 'window' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <Layers size={12} strokeWidth={2} color={subtleTextColor} style={{ marginRight: 2, flexShrink: 0 }} />
            <TitleBtn onClick={() => setZWindowHalf(h => Math.max(15, h - 10))} title="Tighten z-filter" dark={dark}>
              <Minus size={14} strokeWidth={2.5} />
            </TitleBtn>
            <span style={{ fontSize: 11, color: subtleTextColor, minWidth: 28, textAlign: 'center', fontWeight: 600 }}>
              Z±{zWindowHalf}
            </span>
            <TitleBtn onClick={() => setZWindowHalf(h => Math.min(200, h + 10))} title="Widen z-filter" dark={dark}>
              <Plus size={14} strokeWidth={2.5} />
            </TitleBtn>
          </span>
        )}
        {/* Label mode toggle */}
        <TitleBtn onClick={() => setLabelMode(m => LABEL_MODE_ORDER[(LABEL_MODE_ORDER.indexOf(m) + 1) % LABEL_MODE_ORDER.length])}
          title={`Labels: ${LABEL_MODE_LABELS[labelMode]} (click to cycle)`} dark={dark}>
          <Type size={14} strokeWidth={labelMode === 'off' ? 1.5 : 2.5} style={{ opacity: labelMode === 'off' ? 0.5 : 1 }} />
        </TitleBtn>
        {/* Search */}
        <TitleBtn onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
          title="Search POIs" dark={dark}
          active={searchOpen} activeColor="rgba(255,220,50,0.2)">
          <Search size={14} strokeWidth={2.5} />
        </TitleBtn>
        {/* Dark / light mode */}
        <TitleBtn onClick={() => setDarkMode(d => !d)}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'} dark={dark}>
          {dark ? <SunMedium size={14} strokeWidth={2.5} /> : <MoonStar size={14} strokeWidth={2.5} />}
        </TitleBtn>
        {/* Center on player */}
        <TitleBtn onClick={() => setCenterOnPlayer(c => !c)}
          title={centerOnPlayer ? 'Centered on player (click to free-pan)' : 'Free pan (click to center on player)'}
          dark={dark} active={centerOnPlayer} activeColor="rgba(61,235,52,0.2)">
          <Crosshair size={14} strokeWidth={2.5} color={centerOnPlayer ? PLAYER_COLOR : 'currentColor'} />
        </TitleBtn>
        {/* Close */}
        {onClose && (
          <TitleBtn onClick={() => onClose()} title="Close map" dark={dark} isClose>
            <X size={14} strokeWidth={2.5} />
          </TitleBtn>
        )}
      </div>

      {/* Search panel */}
      {searchOpen && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 7px', background: dark ? 'rgba(20,20,22,0.95)' : 'rgba(220,210,190,0.95)',
          borderBottom: titleBorder, flexShrink: 0,
          fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: 12,
        }}>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchMatchIdx(0); }}
            onKeyDown={e => {
              if (e.key === 'Enter') cycleSearchResult(e.shiftKey ? -1 : 1);
              if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
            }}
            placeholder="Search..."
            style={{
              flex: 1, background: dark ? 'rgba(40,40,44,0.9)' : 'rgba(255,250,240,0.9)',
              border: dark ? '1px solid #444' : '1px solid #baa880',
              borderRadius: 3, padding: '2px 6px', fontSize: 12,
              color: dark ? '#ddd' : '#333', outline: 'none',
            }}
          />
          <span style={{ color: subtleTextColor, fontSize: 11, minWidth: 40, textAlign: 'center' }}>
            {searchQuery ? `${searchMatches.length > 0 ? searchMatchIdx + 1 : 0}/${searchMatches.length}` : ''}
          </span>
          <TitleBtn onClick={() => cycleSearchResult(-1)} title="Previous result" dark={dark} compact>
            <ChevronUp size={14} strokeWidth={2.5} />
          </TitleBtn>
          <TitleBtn onClick={() => cycleSearchResult(1)} title="Next result" dark={dark} compact>
            <ChevronDown size={14} strokeWidth={2.5} />
          </TitleBtn>
        </div>
      )}

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
