import * as path from 'path';
import * as fs from 'fs';
import { logInfo, logWarn } from './logger';

export interface SpellInfo {
  baseDmg: number;   // Absolute base damage; 0 for non-damage spells
  maxDmg: number;    // Max damage (level-scaling cap); equals baseDmg if non-scaling
  castMs: number;    // Cast time in milliseconds
  calc: number;      // Effect calc formula from field [70] — determines level scaling
  minLevel: number;  // Lowest class level requirement (for scaling reference)
}

export interface LandingSpellInfo extends SpellInfo {
  spellName: string;
}

interface ParsedSpellRow {
  name: string;
  baseVal: number;
  maxVal: number;
  castMs: number;
  calcVal: number;
  landingMsg: string;
  lowestClassLevel: number;
  isPlayerCastable: boolean;
  isDamage: boolean;
  baseDmg: number;
  maxDmg: number;
}

// Field indices in the ^-separated spells_us.txt format
const F_NAME = 1;
const F_CAST_TIME = 13;
const F_BASE_START = 20;   // Base values for effect slots 1-12 (fields 20-31)
const F_MAX_START = 44;    // Max values for effect slots 1-12 (fields 44-55)
const F_CALC_START = 70;   // Calc formulas for effect slots 1-12 (fields 70-81)
const EFFECT_SLOT_COUNT = 12;
const F_ATTRIB_START = 86;   // SPA (spell effect type) for effect slots 1-12 (fields 86-97)
const SPA_HP = 0;            // SPA 0 = Current HP change; negative base = damage
const F_CLASS_START = 104;
const F_CLASS_COUNT = 16;
const MIN_FIELDS = 120;

/**
 * Calculate the expected damage of a spell at a given caster level.
 * Uses the EQ effect calc formula system:
 *   calc=0 or 100: flat (damage = baseDmg)
 *   calc 1-99:     damage = baseDmg + level * calc
 *   calc 101:      damage = baseDmg + floor(level / 2)
 *   calc 102:      damage = baseDmg + level
 *   calc 103:      damage = baseDmg + level * 2
 *   calc 104:      damage = baseDmg + level * 3
 *   calc 105:      damage = baseDmg + level * 4
 * All results capped at maxDmg. Returns 0 for non-damage spells.
 */
export function calcExpectedDamage(spell: SpellInfo, level: number): number {
  if (spell.baseDmg <= 0) return 0;

  let dmg = spell.baseDmg;
  const c = spell.calc;

  if (c === 0 || c === 100) {
    dmg = spell.baseDmg;
  } else if (c > 0 && c < 100) {
    dmg = spell.baseDmg + level * c;
  } else if (c === 101) {
    dmg = spell.baseDmg + Math.floor(level / 2);
  } else if (c === 102) {
    dmg = spell.baseDmg + level;
  } else if (c === 103) {
    dmg = spell.baseDmg + level * 2;
  } else if (c === 104) {
    dmg = spell.baseDmg + level * 3;
  } else if (c === 105) {
    dmg = spell.baseDmg + level * 4;
  } else {
    // Unknown formula — return 0 to signal "use wide range instead"
    return 0;
  }

  return spell.maxDmg > 0 ? Math.min(dmg, spell.maxDmg) : dmg;
}

const F_LANDING_MSG = 7; // cast_on_other field

function parseSpellRow(f: string[]): ParsedSpellRow | null {
  if (f.length < MIN_FIELDS) return null;

  const name = f[F_NAME]?.trim();
  if (!name) return null;

  let isPlayerCastable = false;
  let lowestClassLevel = 255;
  for (let i = 0; i < F_CLASS_COUNT; i++) {
    const lv = parseInt(f[F_CLASS_START + i]) || 255;
    if (lv < 255) {
      isPlayerCastable = true;
      if (lv < lowestClassLevel) lowestClassLevel = lv;
    }
  }

  const castMs = parseInt(f[F_CAST_TIME]) || 0;
  const landingMsg = (f[F_LANDING_MSG] || '').trim();

  // Scan all 12 effect slots for the first HP-damage slot.
  // Only SPA 0 (Current HP) with a negative base is actual damage.
  // Other SPAs use negative values for non-damage effects (e.g. SPA 99 = Root
  // with base -10000 for movement rate, SPA 3 = Snare with base -40).
  let baseVal = 0;
  let maxVal = 0;
  let calcVal = 0;
  for (let slot = 0; slot < EFFECT_SLOT_COUNT; slot++) {
    const slotBase = parseInt(f[F_BASE_START + slot]) || 0;
    const slotAttrib = parseInt(f[F_ATTRIB_START + slot]) || 0;
    if (slotBase < 0 && slotAttrib === SPA_HP) {
      baseVal = slotBase;
      maxVal = parseInt(f[F_MAX_START + slot]) || 0;
      calcVal = parseInt(f[F_CALC_START + slot]) || 0;
      break;
    }
  }

  const isDamage = baseVal < 0;
  const baseDmg = isDamage ? Math.abs(baseVal) : 0;
  const absMax = Math.abs(maxVal);
  const maxDmg = isDamage && absMax > baseDmg ? absMax : baseDmg;

  return {
    name, baseVal, maxVal, castMs, calcVal, landingMsg,
    lowestClassLevel, isPlayerCastable, isDamage, baseDmg, maxDmg,
  };
}

/**
 * Single-pass loader: builds both the spell DB and landing message map
 * from one read of spells_us.txt. Returns both together to avoid parsing twice.
 */
export function loadAllSpellData(eqDir: string): {
  spellDb: Record<string, SpellInfo>;
  landingMap: Record<string, LandingSpellInfo[]>;
} {
  const filePath = path.join(eqDir, 'spells_us.txt');
  if (!fs.existsSync(filePath)) {
    logWarn('spells_us.txt not found', { path: filePath });
    return { spellDb: {}, landingMap: {} };
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const spellDb: Record<string, SpellInfo> = {};
  const landingMap: Record<string, LandingSpellInfo[]> = {};
  let total = 0;
  let dmgCount = 0;
  let landingCount = 0;

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const row = parseSpellRow(line.split('^'));
    if (!row) continue;

    // Spell DB: only player-castable spells
    if (row.isPlayerCastable) {
      const key = row.name.toLowerCase();
      const entry: SpellInfo = {
        baseDmg: row.baseDmg, maxDmg: row.maxDmg, castMs: row.castMs,
        calc: row.calcVal, minLevel: row.lowestClassLevel,
      };
      total++;
      if (row.isDamage) dmgCount++;

      const existing = spellDb[key];
      if (!existing || (entry.baseDmg > 0 && entry.baseDmg > existing.baseDmg)) {
        spellDb[key] = entry;
      }
    }

    // Landing map: player-castable damage spells with landing messages.
    // NPC-only spells are excluded to avoid false attribution (e.g. Stone Feet
    // is an NPC root spell whose " stumbles." landing would incorrectly match
    // player casts during correlation).
    if (row.isDamage && row.landingMsg && row.isPlayerCastable) {
      const landKey = row.landingMsg.toLowerCase();
      if (!landingMap[landKey]) landingMap[landKey] = [];
      if (!landingMap[landKey].some(e => e.spellName.toLowerCase() === row.name.toLowerCase())) {
        landingMap[landKey].push({
          spellName: row.name,
          baseDmg: row.baseDmg, maxDmg: row.maxDmg, castMs: row.castMs,
          calc: row.calcVal, minLevel: row.lowestClassLevel,
        });
        landingCount++;
      }
    }
  }

  logInfo('Spell data loaded (single pass)', {
    file: filePath,
    playerCastable: total,
    damageSpells: dmgCount,
    uniqueNames: Object.keys(spellDb).length,
    landingSuffixes: Object.keys(landingMap).length,
    landingEntries: landingCount,
  });

  return { spellDb, landingMap };
}

/**
 * @deprecated Use loadAllSpellData() instead to avoid parsing spells_us.txt twice.
 */
export function loadSpellDatabase(eqDir: string): Record<string, SpellInfo> {
  return loadAllSpellData(eqDir).spellDb;
}

/**
 * @deprecated Use loadAllSpellData() instead to avoid parsing spells_us.txt twice.
 */
export function buildLandingMessageMap(eqDir: string): Record<string, LandingSpellInfo[]> {
  return loadAllSpellData(eqDir).landingMap;
}

