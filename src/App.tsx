import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import DamageMeter from './DamageMeter';
import { useCombatTracker } from './useCombatTracker';

function App() {
  const [attached, setAttached] = useState(false);
  const [character, setCharacter] = useState('');
  const {
    processEvents, reset, getDisplayData, seedClassDb, seedSpellDb, seedLandingMap,
    viewMode, setViewMode, fightIdx, setFightIdx, evtCount,
    inCombat, showMode, setShowMode,
    assignPetOwner, getSuggestedPetOwners, setPlayerNameImmediate,
    resetOverall,
  } = useCombatTracker(character);

  const dragging = useRef(false);
  const dragAnchor = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);

  const [meterH, setMeterH] = useState(window.innerHeight);

  useEffect(() => {
    const onResize = () => setMeterH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onTooltipShow = useCallback((player: any, viewMode: string, barTop: number, barBottom: number) => {
    window.electronAPI.showTooltip({ player, viewMode, barTop, barBottom });
  }, []);

  const onTooltipHide = useCallback(() => {
    window.electronAPI.hideTooltip();
  }, []);

  const processRef = useRef(processEvents);
  const resetRef = useRef(reset);
  const seedClassDbRef = useRef(seedClassDb);
  const seedSpellDbRef = useRef(seedSpellDb);
  const seedLandingMapRef = useRef(seedLandingMap);
  const setPlayerNameImmediateRef = useRef(setPlayerNameImmediate);
  processRef.current = processEvents;
  resetRef.current = reset;
  seedClassDbRef.current = seedClassDb;
  seedSpellDbRef.current = seedSpellDb;
  seedLandingMapRef.current = seedLandingMap;
  setPlayerNameImmediateRef.current = setPlayerNameImmediate;

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragAnchor.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    window.electronAPI.startResize(e.screenX, e.screenY);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Single set of window-level mouse handlers for both drag and resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        window.electronAPI.moveWindow(
          e.screenX - dragAnchor.current.x,
          e.screenY - dragAnchor.current.y,
        );
      }
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        window.electronAPI.stopDragResize();
      }
      if (resizing.current) {
        resizing.current = false;
        window.electronAPI.stopResize();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // IPC listeners — register once, use refs to avoid re-registration.
  // After registering, request current state from the main process so
  // HMR re-mounts recover the character name, class DB, and spell DB.
  useEffect(() => {
    console.log('[meter] Renderer mounted, registering IPC listeners');
    window.electronAPI.onCombatEvents((events) => processRef.current(events));
    window.electronAPI.onLogStatus((status) => {
      console.log('[meter] log-status received:', status.character, 'attached:', status.attached);
      setAttached(status.attached);
      if (status.character) {
        setPlayerNameImmediateRef.current(status.character);
        setCharacter(status.character);
      }
    });
    window.electronAPI.onReset(() => resetRef.current());
    window.electronAPI.onClassDb((db) => seedClassDbRef.current(db));
    window.electronAPI.onSpellDb((db) => seedSpellDbRef.current(db));
    window.electronAPI.onLandingMap((map) => seedLandingMapRef.current(map));
    console.log('[meter] Sending requestStatus()');
    window.electronAPI.requestStatus();
  }, []);

  const data = getDisplayData();

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: meterH, display: 'flex', flexDirection: 'column' }}>
      <DamageMeter
        players={data.players}
        totalValue={data.totalValue}
        duration={data.duration}
        targetName={data.targetName}
        fightCount={data.fightCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        fightIdx={fightIdx}
        onFightIdxChange={setFightIdx}
        onReset={reset}
        attached={attached}
        evtCount={evtCount}
        character={character}
        onDragStart={onDragStart}
        onResizeStart={onResizeStart}
        isDragging={dragging.current}
        inCombat={inCombat}
        showMode={showMode}
        onShowModeChange={setShowMode}
        onAssignPetOwner={assignPetOwner}
        getSuggestedPetOwners={getSuggestedPetOwners}
        onResetOverall={resetOverall}
        onTooltipShow={onTooltipShow}
        onTooltipHide={onTooltipHide}
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
