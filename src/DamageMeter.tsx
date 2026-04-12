import React, { useState, useCallback } from 'react';
import type { DisplayPlayer, ViewMode } from './useCombatTracker';
import { ClassIcon } from './classIcons';
import { fmt, FONT_NUM } from './TooltipContent';

function fmtDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const BAR_HEIGHT = 23;
const FONT_BAR = '"Arial Narrow", "Arial Nova Cond", Arial, Helvetica, sans-serif';

interface Props {
  players: DisplayPlayer[];
  totalValue: number;
  duration: number;
  targetName: string;
  fightCount: number;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  fightIdx: number;
  onFightIdxChange: (i: number) => void;
  onReset: () => void;
  attached: boolean;
  evtCount: number;
  character: string;
  onDragStart?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  inCombat?: boolean;
  showMode: 'session' | 'current';
  onShowModeChange: (m: 'session' | 'current') => void;
  onAssignPetOwner?: (petName: string, ownerName: string) => void;
  getSuggestedPetOwners?: () => string[];
  onResetSession?: () => void;
  onTooltipShow?: (player: DisplayPlayer, viewMode: ViewMode, barTop: number, barBottom: number) => void;
  onTooltipHide?: () => void;
  mapVisible?: boolean;
  onToggleMap?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  petName: string;
}


function barGradient(hex: string, barPct: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const bright = `rgba(${Math.round(r * 0.65)},${Math.round(g * 0.65)},${Math.round(b * 0.65)},0.95)`;
  const mid = `rgba(${Math.round(r * 0.42)},${Math.round(g * 0.42)},${Math.round(b * 0.42)},0.9)`;
  const dark = `rgba(${Math.round(r * 0.18)},${Math.round(g * 0.18)},${Math.round(b * 0.18)},0.85)`;
  return `linear-gradient(90deg, ${bright} 0%, ${mid} ${Math.floor(barPct * 0.4)}%, ${dark} ${barPct}%, transparent ${barPct}%)`;
}

function edgeHighlights(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const top = `rgba(${Math.min(255, Math.round(r * 0.8))},${Math.min(255, Math.round(g * 0.8))},${Math.min(255, Math.round(b * 0.8))},0.35)`;
  const bot = `rgba(${Math.round(r * 0.5)},${Math.round(g * 0.5)},${Math.round(b * 0.5)},0.2)`;
  return `linear-gradient(180deg, ${top} 0px, transparent 1px, transparent calc(100% - 1px), ${bot} 100%)`;
}



export default function DamageMeter(props: Props) {
  const {
    players, duration, targetName, fightCount,
    viewMode, onViewModeChange, fightIdx, onFightIdxChange,
    onReset, attached, evtCount, character,
    onDragStart, onResizeStart, isDragging, inCombat,
    showMode, onShowModeChange,
    onAssignPetOwner, getSuggestedPetOwners, onResetSession,
    onTooltipShow, onTooltipHide,
    mapVisible, onToggleMap,
  } = props;
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [copied, setCopied] = useState(false);

  const onBarEnter = useCallback((e: React.MouseEvent, p: DisplayPlayer) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoveredName(p.name);
    onTooltipShow?.(p, viewMode, rect.top, rect.bottom);
  }, [onTooltipShow, viewMode]);

  const onBarsLeave = useCallback(() => {
    setHoveredName(null);
    onTooltipHide?.();
  }, [onTooltipHide]);

  const onBarContextMenu = useCallback((e: React.MouseEvent, p: DisplayPlayer) => {
    if (!p.isUnownedPet || !onAssignPetOwner) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, petName: p.name });
  }, [onAssignPetOwner]);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const copyToClipboard = useCallback(() => {
    if (players.length === 0) return;
    const dur = duration > 0 ? fmtDur(duration) : '0:00';
    const modeTag = viewMode === 'damage' ? 'DMG'
      : viewMode === 'healing' ? 'HPS' : 'DTPS';
    const lines = players.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.name}${p.classShort ? ' [' + p.classShort + ']' : ''} - ${fmt(p.value)} (${p.dps}) ${p.pct.toFixed(1)}%`
    );
    const text = `p99-meter ${modeTag} (${dur}) | Total: ${fmt(props.totalValue)}\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [players, duration, viewMode, props.totalValue]);

  // Build the list of players the pet can be assigned to
  const ctxOwnerOptions = ctxMenu ? (() => {
    const suggested = new Set(getSuggestedPetOwners?.() || []);
    const others: string[] = [];
    for (const p of players) {
      if (p.isUnownedPet) continue;
      if (suggested.has(p.name)) continue;
      others.push(p.name);
    }
    return { suggested: [...suggested], others };
  })() : { suggested: [], others: [] };

  const modeLabel = viewMode === 'damage' ? 'Damage Done'
    : viewMode === 'healing' ? 'Healing Done'
    : 'Damage Taken';

  return (
    <>
    <div style={{
      position: 'relative', width: '100%', flex: 1, minHeight: 0,
      background: 'rgba(12,12,14,0.94)',
      border: '1px solid rgba(60,60,60,0.4)',
      borderRadius: 3,
      overflow: 'hidden',
      fontFamily: FONT_BAR,
      fontSize: 12,
      color: '#ddd',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 2px 12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* ═══ Title bar ═══ */}
      <div
        onMouseDown={onDragStart}
        style={{
          height: 26,
          display: 'flex',
          alignItems: 'center',
          padding: '0 7px',
          background: 'linear-gradient(180deg, #333338 0%, #222226 50%, #1a1a1e 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.6)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span style={{ opacity: 0.25, fontSize: 9, letterSpacing: 1, color: '#aaa', flexShrink: 0 }}>⠿</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <button
            onClick={() => {
              const modes: ViewMode[] = ['damage', 'healing', 'damageTaken'];
              const prev = modes[(modes.indexOf(viewMode) + modes.length - 1) % modes.length];
              onViewModeChange(prev);
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#666', fontSize: 9, padding: '0 3px', lineHeight: 1,
            }}
          >◀</button>
          <button
            onClick={() => {
              const modes: ViewMode[] = ['damage', 'healing', 'damageTaken'];
              const next = modes[(modes.indexOf(viewMode) + 1) % modes.length];
              onViewModeChange(next);
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#e8dcc8', fontSize: 14, fontFamily: '"Segoe UI", "Calibri", "Trebuchet MS", sans-serif',
              fontWeight: 600, padding: '0 2px', letterSpacing: 0.2,
              textShadow: '0 1px 3px rgba(0,0,0,1)',
            }}
          >
            {modeLabel}
          </button>
          <button
            onClick={() => {
              const modes: ViewMode[] = ['damage', 'healing', 'damageTaken'];
              const next = modes[(modes.indexOf(viewMode) + 1) % modes.length];
              onViewModeChange(next);
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#666', fontSize: 9, padding: '0 3px', lineHeight: 1,
            }}
          >▶</button>
        </div>

        <span style={{ flex: 1 }} />

        {onToggleMap && (
          <button
            onClick={onToggleMap}
            title={mapVisible ? 'Hide map' : 'Show map'}
            style={{
              background: mapVisible ? 'rgba(61,235,52,0.12)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: mapVisible ? '#3deb34' : '#666',
              fontSize: 12,
              padding: '0 3px',
              transition: 'color 0.2s',
              flexShrink: 0,
            }}
          >⊞</button>
        )}

        {players.length > 0 && (
          <button
            onClick={copyToClipboard}
            title="Copy results to clipboard"
            style={{
              background: copied ? 'rgba(0,204,0,0.15)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: copied ? '#4ade80' : '#666',
              fontSize: 13,
              padding: '0 3px',
              transition: 'color 0.2s',
              flexShrink: 0,
            }}
          >{copied ? '✓' : '📋'}</button>
        )}
      </div>

      {/* ═══ Bars list ═══ */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 60 }} onMouseLeave={onBarsLeave}>
        {players.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 60, color: '#444', fontSize: 12, fontFamily: FONT_BAR,
          }}>
            {attached ? 'Waiting for combat...' : 'Waiting for EverQuest...'}
          </div>
        ) : (
          players.map((p, i) => {
            const isHovered = hoveredName === p.name;
            return (
              <div
                key={p.name}
                style={{
                  position: 'relative',
                  height: BAR_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  background: i % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(8,8,12,0.15)',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => onBarEnter(e, p)}
                onContextMenu={(e) => onBarContextMenu(e, p)}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
                  backgroundImage: barGradient(p.color, p.barPct),
                  transition: 'background-image 0.3s ease-out',
                }} />

                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  width: `${p.barPct}%`,
                  backgroundImage: edgeHighlights(p.color),
                  transition: 'width 0.3s ease-out',
                  pointerEvents: 'none',
                }} />

                {isHovered && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(255,255,255,0.06)',
                  }} />
                )}

                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: 1,
                  background: 'rgba(0,0,0,0.4)',
                }} />

                <div style={{
                  position: 'relative', zIndex: 1, display: 'flex', width: '100%', alignItems: 'center',
                  padding: '0 5px', fontSize: 12, lineHeight: 1, userSelect: 'none', gap: 3,
                }}>
                  <span style={{
                    width: 16, textAlign: 'right',
                    color: 'rgba(255,255,255,0.85)', fontFamily: FONT_BAR, fontSize: 12,
                    fontWeight: 700,
                    textShadow: '0 0 4px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,0.9)',
                  }}>{i + 1}</span>

                  <ClassIcon eqClass={p.eqClass} color={p.color} />

                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: FONT_BAR,
                    fontWeight: 400, fontSize: 12, letterSpacing: 0.2,
                    color: p.isUnownedPet ? '#cba6ff' : '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.5)',
                    fontStyle: p.isUnownedPet ? 'italic' : 'normal',
                  }}>
                    {p.isUnownedPet && <span title="Right-click to assign owner" style={{ fontSize: 9, marginRight: 3, opacity: 0.7 }}>Pet</span>}
                    {p.name}
                  </span>

                  <span style={{
                    fontFamily: FONT_NUM, fontSize: 12, fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  }}>{fmt(p.value)}</span>

                  <span style={{
                    fontFamily: FONT_NUM, fontSize: 12,
                    color: 'rgba(255,255,255,0.7)',
                    width: 48, textAlign: 'right',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}>({p.dps})</span>

                  <span style={{
                    fontFamily: FONT_NUM, fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                    width: 40, textAlign: 'right',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}>{p.pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ═══ Footer ═══ */}
      <div style={{
        height: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 6px',
        background: 'linear-gradient(180deg, #252528 0%, #19191c 100%)',
        borderTop: '1px solid rgba(0,0,0,0.6)',
        fontSize: 11, userSelect: 'none', fontFamily: FONT_BAR,
        gap: 4,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          <button
            onClick={() => { onFightIdxChange(-1); onShowModeChange('session'); }}
            style={{
              background: showMode === 'session' ? 'rgba(255,209,0,0.12)' : 'rgba(255,255,255,0.03)',
              color: showMode === 'session' ? '#ffd100' : '#999',
              border: showMode === 'session' ? '1px solid rgba(255,209,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '3px 0 0 3px',
              padding: '2px 10px', cursor: 'pointer',
              fontSize: 11, fontFamily: FONT_BAR, fontWeight: showMode === 'session' ? 700 : 400,
              letterSpacing: 0.3,
              textShadow: showMode === 'session' ? '0 0 4px rgba(255,209,0,0.3)' : 'none',
            }}
          >Session</button>
          <button
            onClick={() => onShowModeChange('current')}
            style={{
              background: showMode === 'current' ? 'rgba(255,209,0,0.12)' : 'rgba(255,255,255,0.03)',
              color: showMode === 'current' ? '#ffd100' : '#999',
              border: showMode === 'current' ? '1px solid rgba(255,209,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0 3px 3px 0',
              padding: '2px 10px', cursor: 'pointer',
              fontSize: 11, fontFamily: FONT_BAR, fontWeight: showMode === 'current' ? 700 : 400,
              letterSpacing: 0.3,
              textShadow: showMode === 'current' ? '0 0 4px rgba(255,209,0,0.3)' : 'none',
            }}
          >Current</button>
          {showMode === 'session' && onResetSession && (
            <button
              onClick={() => { onResetSession(); onFightIdxChange(-1); }}
              style={{
                background: 'none', border: 'none', color: '#666',
                cursor: 'pointer', fontSize: 12, padding: '0 4px', marginLeft: 3,
                fontFamily: FONT_BAR, lineHeight: 1,
              }}
              title="Reset Session — clears accumulated data and starts fresh"
            >↺</button>
          )}
        </div>

        <button onClick={onReset} style={{
          background: 'transparent', color: '#555', border: 'none',
          cursor: 'pointer', fontSize: 11, padding: '0 4px',
          fontFamily: FONT_BAR,
        }} title="Reset meter">✕</button>

        {showMode === 'session' && fightCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, color: '#555' }}>
            <button
              onClick={() => onFightIdxChange(Math.max(0, (fightIdx === -1 ? fightCount - 1 : fightIdx) - 1))}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 9, padding: '0 2px' }}
            >◀</button>
            <span style={{ minWidth: 42, textAlign: 'center', fontSize: 10, fontFamily: FONT_NUM }}>
              {fightIdx === -1 ? `${fightCount}` : `${fightIdx + 1}/${fightCount}`}
            </span>
            <button
              onClick={() => onFightIdxChange(Math.min(fightCount - 1, (fightIdx === -1 ? 0 : fightIdx) + 1))}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 9, padding: '0 2px' }}
            >▶</button>
          </div>
        )}

        <span style={{ flex: 1 }} />

        {/* Resize grip */}
        <div
          onMouseDown={onResizeStart}
          style={{
            cursor: 'nwse-resize',
            padding: '2px 2px 2px 6px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity: 0.45 }}>
            <line x1="11" y1="3" x2="3" y2="11" stroke="#aaa" strokeWidth="1.2" />
            <line x1="11" y1="6" x2="6" y2="11" stroke="#aaa" strokeWidth="1.2" />
            <line x1="11" y1="9" x2="9" y2="11" stroke="#aaa" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

    </div>

      {/* ═══ Context menu for pet owner assignment ═══ */}
      {ctxMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={closeCtxMenu}
            onContextMenu={(e) => { e.preventDefault(); closeCtxMenu(); }}
          />
          <div style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'rgba(28,28,32,0.98)',
            border: '1px solid #555',
            borderRadius: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.9)',
            minWidth: 160,
            zIndex: 200,
            fontFamily: FONT_BAR,
            fontSize: 12,
            padding: '4px 0',
          }}>
            <div style={{
              padding: '4px 12px 6px',
              color: '#cba6ff',
              fontSize: 11,
              borderBottom: '1px solid #444',
              fontWeight: 600,
            }}>
              Assign <span style={{ color: '#fff' }}>{ctxMenu.petName}</span> to:
            </div>

            {ctxOwnerOptions.suggested.length > 0 && (
              <>
                <div style={{ padding: '4px 12px 2px', color: '#666', fontSize: 10 }}>Likely owners</div>
                {ctxOwnerOptions.suggested.map(name => (
                  <div
                    key={name}
                    onClick={() => {
                      onAssignPetOwner?.(ctxMenu.petName, name);
                      closeCtxMenu();
                    }}
                    style={{
                      padding: '4px 12px',
                      cursor: 'pointer',
                      color: '#7cff7c',
                      fontWeight: 600,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {name}
                  </div>
                ))}
              </>
            )}

            {ctxOwnerOptions.others.length > 0 && (
              <>
                {ctxOwnerOptions.suggested.length > 0 && (
                  <div style={{ borderTop: '1px solid #333', margin: '2px 0' }} />
                )}
                <div style={{ padding: '4px 12px 2px', color: '#666', fontSize: 10 }}>All players</div>
                {ctxOwnerOptions.others.map(name => (
                  <div
                    key={name}
                    onClick={() => {
                      onAssignPetOwner?.(ctxMenu.petName, name);
                      closeCtxMenu();
                    }}
                    style={{
                      padding: '4px 12px',
                      cursor: 'pointer',
                      color: '#ddd',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {name}
                  </div>
                ))}
              </>
            )}

            {ctxOwnerOptions.suggested.length === 0 && ctxOwnerOptions.others.length === 0 && (
              <div style={{ padding: '6px 12px', color: '#666', fontStyle: 'italic' }}>
                No players found
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
