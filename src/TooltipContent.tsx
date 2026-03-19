import React from 'react';
import type { DisplayPlayer, DisplayAbility, PetDisplayInfo, ViewMode } from './useCombatTracker';
import { ClassIcon } from './classIcons';

export const FONT_NUM = '"Segoe UI", "Calibri", Arial, sans-serif';
const FONT_BAR = '"Arial Narrow", "Arial Nova Cond", Arial, Helvetica, sans-serif';

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(2) + 'k';
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

function TipRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, lineHeight: 1.6 }}>
      <span style={{ color: '#bbb', fontSize: 12 }}>{label}</span>
      <span style={{ color: color || '#eee', fontSize: 12, fontFamily: FONT_NUM }}>
        {value}
        {sub && <span style={{ color: '#888', marginLeft: 4, fontSize: 10 }}>{sub}</span>}
      </span>
    </div>
  );
}

function AbilityRow({ ab, color, total }: { ab: DisplayAbility; color: string; total: number }) {
  const pct = total > 0 ? (ab.damage / total) * 100 : 0;
  return (
    <div style={{ position: 'relative', padding: '1px 0', marginBottom: 1 }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: `${pct}%`,
        background: color,
        opacity: 0.12,
        borderRadius: 1,
      }} />
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        fontSize: 12, lineHeight: 1.5, padding: '0 3px', gap: 5,
      }}>
        <span style={{
          flex: 1, color: '#ddd',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{ab.name}</span>
        <span style={{ color: '#bbb', fontFamily: FONT_NUM, fontSize: 12, minWidth: 44, textAlign: 'right' }}>
          {fmt(ab.damage)}
        </span>
        <span style={{ color: '#aaa', fontFamily: FONT_NUM, fontSize: 10, minWidth: 34, textAlign: 'right' }}>
          {pct.toFixed(1)}%
        </span>
        <span style={{ color: '#777', fontFamily: FONT_NUM, fontSize: 10, minWidth: 22, textAlign: 'right' }}>
          {ab.hits}
        </span>
      </div>
    </div>
  );
}

function PetSection({ pet, ownerColor }: { pet: PetDisplayInfo; ownerColor: string }) {
  return (
    <div style={{ marginTop: 2 }}>
      <div style={{
        fontSize: 12, color: '#cba6ff', fontWeight: 600,
        display: 'flex', justifyContent: 'space-between', marginBottom: 2,
      }}>
        <span>Pet</span>
        <span style={{ fontFamily: FONT_NUM, color: '#bbb' }}>{fmt(pet.damage)}</span>
      </div>
      {pet.abilities.map((ab: DisplayAbility) => (
        <AbilityRow key={ab.name} ab={ab} color={ownerColor} total={pet.damage} />
      ))}
    </div>
  );
}

export function TooltipContent({ player: p, viewMode }: { player: DisplayPlayer; viewMode: ViewMode }) {
  return (
    <>
      <div style={{
        fontWeight: 700, fontSize: 14,
        color: p.color, marginBottom: 6,
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <ClassIcon eqClass={p.eqClass} color={p.color} />
        {p.name}
        {p.classShort ? (
          <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>
            {p.classShort}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#667', fontWeight: 400, fontStyle: 'italic' }}>
            Unknown
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {viewMode === 'damage' && <>
          <TipRow label="Total" value={fmt(p.damageToMobs)} color="#ffd100" />
          <TipRow label="DPS" value={p.dps} color="#ffd100" />
          <div style={{ borderTop: '1px solid #333', margin: '3px 0' }} />
          <TipRow label="Max Hit" value={fmt(p.maxHit)} sub={p.maxHitSkill ? `(${p.maxHitSkill})` : ''} />
          <TipRow label="Hits" value={String(p.hits)} />
          <TipRow label="Misses" value={String(p.misses)} />
          {(p.hits + p.misses > 0) && (
            <TipRow label="Accuracy" value={`${((p.hits / (p.hits + p.misses)) * 100).toFixed(1)}%`} />
          )}
          {p.abilities.length > 0 && <>
            <div style={{ borderTop: '1px solid #333', margin: '3px 0' }} />
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>Abilities</div>
            {p.abilities.map((ab: DisplayAbility) => (
              <AbilityRow key={ab.name} ab={ab} color={p.color} total={p.damageToMobs} />
            ))}
          </>}
          {p.pets.length > 0 && <>
            <div style={{ borderTop: '1px solid #444', margin: '4px 0' }} />
            {p.pets.map((pet: PetDisplayInfo) => (
              <PetSection key={pet.petName} pet={pet} ownerColor={p.color} />
            ))}
          </>}
        </>}
        {viewMode === 'healing' && <>
          <TipRow label="Total Healing" value={fmt(p.healingDone)} color="#4ade80" />
          <TipRow label="HPS" value={p.dps} color="#4ade80" />
        </>}
        {viewMode === 'damageTaken' && <>
          <TipRow label="Total Taken" value={fmt(p.damageTaken)} color="#f87171" />
          <div style={{ borderTop: '1px solid #333', margin: '3px 0' }} />
          <TipRow label="Damage Done" value={fmt(p.damageToMobs)} />
          <TipRow label="Healing Done" value={fmt(p.healingDone)} />
        </>}
      </div>
    </>
  );
}
