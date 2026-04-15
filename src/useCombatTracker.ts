import { useState, useRef, useCallback, useEffect } from 'react';
import type { CombatEvent } from './logParser';
import type { EQClass } from './eqClasses';
import {
  CLASS_COLORS, CLASS_SHORT, UNKNOWN_COLOR, MeleeSkillTracker,
  getSpellCandidateClasses, detectClassFromMelee, detectClassFromWho,
  DETECTION_CONFIDENCE,
} from './eqClasses';
import { SpellCorrelator } from './spellCorrelator';
import type { SpellInfo, LandingSpellInfo } from './spellDatabase';
import { isPetName } from './petData';
import {
  COMBAT_TIMEOUT_MS, FIGHT_GAP_MS, SESSION_GAP_MS,
  LABEL_NONMELEE, LABEL_OTHERS_SPELLS,
  isLikelyNPC, normalizeSource, normalizeTarget,
} from './constants';

export interface AbilityStats {
  name: string;
  damage: number;
  hits: number;
  maxHit: number;
}

export interface EntityStats {
  name: string;
  eqClass: EQClass | null;
  damageToMobs: number;
  meleeDmg: number;
  spellDmg: number;
  dsDmg: number;
  dotDmg: number;
  damageTaken: number;
  healingDone: number;
  hits: number;
  misses: number;
  maxHit: number;
  maxHitSkill: string;
  kills: number;
  abilities: Record<string, AbilityStats>;
  isPet: boolean;
  petOwner: string;
}

export interface Fight {
  id: number;
  startTime: number;
  lastEventTime: number;
  knownMobs: Set<string>;
  mobNames: Record<string, string>;
  entities: Record<string, EntityStats>;
  ended: boolean;
}

// COMBAT_TIMEOUT_MS and FIGHT_GAP_MS imported from constants.ts

function emptyEntity(name: string): EntityStats {
  return {
    name, eqClass: null,
    damageToMobs: 0, meleeDmg: 0, spellDmg: 0, dsDmg: 0, dotDmg: 0,
    damageTaken: 0, healingDone: 0, hits: 0, misses: 0,
    maxHit: 0, maxHitSkill: '', kills: 0,
    abilities: {},
    isPet: false, petOwner: '',
  };
}

function recordAbility(entity: EntityStats, abilityName: string, amount: number) {
  if (!entity.abilities[abilityName]) {
    entity.abilities[abilityName] = { name: abilityName, damage: 0, hits: 0, maxHit: 0 };
  }
  const a = entity.abilities[abilityName];
  a.damage += amount;
  a.hits++;
  if (amount > a.maxHit) a.maxHit = amount;
}

function mergeEntity(a: EntityStats, b: EntityStats): EntityStats {
  const maxHit = a.maxHit >= b.maxHit ? a.maxHit : b.maxHit;
  const maxHitSkill = a.maxHit >= b.maxHit ? a.maxHitSkill : b.maxHitSkill;
  const abilities: Record<string, AbilityStats> = {};
  for (const [k, v] of Object.entries(a.abilities)) abilities[k] = { ...v };
  for (const [k, v] of Object.entries(b.abilities)) {
    if (abilities[k]) {
      abilities[k].damage += v.damage;
      abilities[k].hits += v.hits;
      if (v.maxHit > abilities[k].maxHit) abilities[k].maxHit = v.maxHit;
    } else {
      abilities[k] = { ...v };
    }
  }
  return {
    name: a.name, eqClass: a.eqClass || b.eqClass,
    damageToMobs: a.damageToMobs + b.damageToMobs,
    meleeDmg: a.meleeDmg + b.meleeDmg,
    spellDmg: a.spellDmg + b.spellDmg,
    dsDmg: a.dsDmg + b.dsDmg,
    dotDmg: a.dotDmg + b.dotDmg,
    damageTaken: a.damageTaken + b.damageTaken,
    healingDone: a.healingDone + b.healingDone,
    hits: a.hits + b.hits,
    misses: a.misses + b.misses,
    maxHit, maxHitSkill,
    kills: a.kills + b.kills,
    abilities,
    isPet: a.isPet, petOwner: a.petOwner || b.petOwner,
  };
}

function isMob(fight: Fight, name: string): boolean {
  return fight.knownMobs.has(name.toLowerCase());
}

function addMob(fight: Fight, name: string) {
  const lower = name.toLowerCase();
  fight.knownMobs.add(lower);
  if (!fight.mobNames[lower] || (name[0] >= 'A' && name[0] <= 'Z')) {
    fight.mobNames[lower] = name;
  }
}

// isLikelyNPC imported from constants.ts (single canonical implementation)

function getEntity(fight: Fight, name: string): EntityStats {
  if (!fight.entities[name]) fight.entities[name] = emptyEntity(name);
  return fight.entities[name];
}

// Credit damage from attacker → mob, updating all relevant stats.
// isSpell: true for any spell-originated damage (nukes, procs, named spells).
// isDamageShield/isDoT are sub-categories of spell damage.
function creditDamage(
  fight: Fight, attackerName: string, targetName: string,
  amount: number, skillLabel: string, isDamageShield: boolean, isDoT: boolean,
  entityClassMap: Record<string, EQClass>,
  isSpell = false,
) {
  addMob(fight, targetName);
  const e = getEntity(fight, attackerName);
  e.damageToMobs += amount;
  e.hits++;

  if (isDamageShield) {
    e.dsDmg += amount;
  } else if (isDoT) {
    e.dotDmg += amount;
    e.spellDmg += amount;
  } else if (isSpell) {
    e.spellDmg += amount;
  } else {
    e.meleeDmg += amount;
  }

  if (amount > e.maxHit) {
    e.maxHit = amount;
    e.maxHitSkill = skillLabel;
  }
  recordAbility(e, skillLabel, amount);
  e.eqClass = entityClassMap[attackerName] || e.eqClass;
}

/**
 * Retroactively transfer all accumulated pet entity damage to the owner
 * across all fights. Marks the pet entity as a sub-entity of the owner.
 */
function retroactivelyAssignPet(
  fights: Fight[], petName: string, ownerName: string,
  entityClassMap: Record<string, EQClass>,
) {
  for (const fight of fights) {
    const petEntity = fight.entities[petName];
    if (!petEntity) continue;

    // Mark as sub-entity
    petEntity.isPet = true;
    petEntity.petOwner = ownerName;

    // Merge pet's accumulated damage into owner
    const owner = getEntity(fight, ownerName);
    owner.damageToMobs += petEntity.damageToMobs;
    owner.meleeDmg += petEntity.meleeDmg;
    owner.spellDmg += petEntity.spellDmg;
    owner.dsDmg += petEntity.dsDmg;
    owner.dotDmg += petEntity.dotDmg;
    owner.hits += petEntity.hits;
    owner.misses += petEntity.misses;
    owner.kills += petEntity.kills;
    if (petEntity.maxHit > owner.maxHit) {
      owner.maxHit = petEntity.maxHit;
      owner.maxHitSkill = petEntity.maxHitSkill;
    }

    // Merge abilities with "Pet: " prefix
    for (const [abilName, abil] of Object.entries(petEntity.abilities)) {
      const ownerAbilName = 'Pet: ' + abilName;
      if (!owner.abilities[ownerAbilName]) {
        owner.abilities[ownerAbilName] = { name: ownerAbilName, damage: 0, hits: 0, maxHit: 0 };
      }
      const oa = owner.abilities[ownerAbilName];
      oa.damage += abil.damage;
      oa.hits += abil.hits;
      if (abil.maxHit > oa.maxHit) oa.maxHit = abil.maxHit;
    }

    owner.eqClass = entityClassMap[ownerName] || owner.eqClass;
  }
}

export type ViewMode = 'damage' | 'healing' | 'damageTaken';

export interface DisplayAbility {
  name: string;
  damage: number;
  pct: number;
  hits: number;
  maxHit: number;
}

export interface PetDisplayInfo {
  petName: string;
  damage: number;
  abilities: DisplayAbility[];
}

export interface DisplayPlayer {
  name: string;
  eqClass: EQClass | null;
  classShort: string;
  value: number;
  pct: number;
  barPct: number;
  color: string;
  dps: string;
  meleeDmg: number;
  spellDmg: number;
  dsDmg: number;
  dotDmg: number;
  damageTaken: number;
  healingDone: number;
  damageToMobs: number;
  hits: number;
  misses: number;
  maxHit: number;
  maxHitSkill: string;
  kills: number;
  abilities: DisplayAbility[];
  pets: PetDisplayInfo[];
  isUnownedPet: boolean;
}

export function useCombatTracker(playerName: string) {
  const [fights, setFights] = useState<Fight[]>([]);
  const [fightIdx, setFightIdx] = useState(-1);
  const [viewMode, setViewMode] = useState<ViewMode>('damage');
  const [evtCount, setEvtCount] = useState(0);
  const [inCombat, setInCombat] = useState(false);
  const [showMode, setShowMode] = useState<'session' | 'current'>('current');

  const fightsRef = useRef<Fight[]>([]);
  const fightSeq = useRef(0);
  const entityClassMap = useRef<Record<string, EQClass>>({});
  const colorMap = useRef<Record<string, string>>({});
  const playerNameRef = useRef(playerName);
  const correlator = useRef(new SpellCorrelator());
  const combatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skillTracker = useRef(new MeleeSkillTracker());
  const petOwnerMap = useRef<Record<string, string>>({});
  const classCandidates = useRef<Record<string, Set<EQClass>>>({});
  const entityLevelMap = useRef<Record<string, number>>({});
  const pendingEvents = useRef<CombatEvent[]>([]);
  const globalKnownMobs = useRef(new Set<string>());
  const sessionStartId = useRef(0);
  const lastEventTimestamp = useRef(0);
  const trackerEpoch = useRef(Date.now());

  // Keep refs in sync on every render — but never overwrite with empty string
  // if the ref already has a value (protects against HMR re-mount race)
  if (playerName) playerNameRef.current = playerName;

  useEffect(() => {
    if (playerName) {
      correlator.current.setPlayerName(playerName);
    }
    correlator.current.setEntityClassMap(entityClassMap.current);
  }, [playerName]);

  // processEventsRef is populated after processEvents is defined (below)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const processEventsRef = useRef<(events: CombatEvent[]) => void>(() => {});

  // Synchronous setter — call from IPC handlers BEFORE events arrive
  // to avoid the React re-render race (setCharacter is async, but this is immediate).
  // Also drains any events that arrived before the name was known.
  const setPlayerNameImmediate = useCallback((name: string) => {
    if (!name) return;
    playerNameRef.current = name;
    correlator.current.setPlayerName(name);
    if (pendingEvents.current.length > 0) {
      const queued = pendingEvents.current;
      pendingEvents.current = [];
      console.log('[meter] Draining', queued.length, 'queued events for', name);
      processEventsRef.current(queued);
    }
  }, []);

  const markOutOfCombat = useCallback(() => {
    setInCombat(false);
    const all = fightsRef.current;
    if (all.length > 0) {
      all[all.length - 1].ended = true;
      fightsRef.current = [...all];
      setFights([...all]);
    }
  }, []);

  const resetCombatTimer = useCallback(() => {
    if (combatTimer.current) clearTimeout(combatTimer.current);
    setInCombat(true);
    combatTimer.current = setTimeout(markOutOfCombat, COMBAT_TIMEOUT_MS);
  }, [markOutOfCombat]);

  useEffect(() => {
    return () => { if (combatTimer.current) clearTimeout(combatTimer.current); };
  }, []);

  const updateColor = useCallback((name: string, cls: EQClass | null) => {
    if (cls && CLASS_COLORS[cls]) {
      colorMap.current[name] = CLASS_COLORS[cls];
    } else if (!colorMap.current[name]) {
      colorMap.current[name] = UNKNOWN_COLOR;
    }
  }, []);

  const classConfidence = useRef<Record<string, number>>({});

  const setEntityClass = useCallback((name: string, cls: EQClass, confidence: number = 3) => {
    const existing = entityClassMap.current[name];
    const existingConf = classConfidence.current[name] ?? 0;

    if (existing === cls) {
      // Same class, just bump confidence if higher
      if (confidence > existingConf) classConfidence.current[name] = confidence;
      return;
    }

    if (existing && confidence <= existingConf) {
      // Already have a higher-confidence detection, don't overwrite
      return;
    }

    entityClassMap.current[name] = cls;
    classConfidence.current[name] = confidence;
    colorMap.current[name] = CLASS_COLORS[cls];
    if (typeof window !== 'undefined' && window.electronAPI?.saveClass) {
      window.electronAPI.saveClass(name, cls);
    }
  }, []);

  // Seed the in-memory class map from the persisted DB (called once on startup)
  // Seeded entries get spell_cast-level confidence — overridable by /who but not by guesses
  const seedClassDb = useCallback((db: Record<string, string>) => {
    for (const [name, cls] of Object.entries(db)) {
      if (CLASS_COLORS[cls as EQClass] && !entityClassMap.current[name]) {
        entityClassMap.current[name] = cls as EQClass;
        colorMap.current[name] = CLASS_COLORS[cls as EQClass];
        classConfidence.current[name] = DETECTION_CONFIDENCE['spell_cast'];
      }
    }
  }, []);

  const seedSpellDb = useCallback((db: Record<string, SpellInfo>) => {
    correlator.current.setSpellDb(db);
  }, []);

  const seedLandingMap = useCallback((map: Record<string, LandingSpellInfo[]>) => {
    correlator.current.setLandingMap(map);
  }, []);

  const tryInferClassFromSkills = useCallback((name: string) => {
    const cls = skillTracker.current.inferClass(name);
    if (cls) setEntityClass(name, cls, DETECTION_CONFIDENCE['melee_infer']);
  }, [setEntityClass]);

  // Get or create a fight for the given timestamp.
  // A new fight starts ONLY on a real time gap — the `ended` flag is purely visual
  // (combat timer expired) and doesn't seal the fight from receiving more events.
  // This matches Details! behavior: "current" keeps showing until genuinely new combat.
  function getOrCreateFight(
    all: Fight[], timestamp: number, requireDamage: boolean,
  ): Fight | null {
    const last = all[all.length - 1];
    const gap = last ? timestamp - last.lastEventTime > FIGHT_GAP_MS : true;

    if (gap || !last) {
      if (requireDamage) {
        const fight: Fight = {
          id: fightSeq.current++, startTime: timestamp, lastEventTime: timestamp,
          knownMobs: new Set(), mobNames: {}, entities: {}, ended: false,
        };
        all.push(fight);
        return fight;
      }
      return last || null;
    }

    // Re-open an "ended" fight if new activity arrives within the gap window
    if (last.ended) last.ended = false;
    return last;
  }

  const processEvents = useCallback((events: CombatEvent[]) => {
    const all = fightsRef.current;
    const pName = playerNameRef.current;
    const corr = correlator.current;
    const clsMap = entityClassMap.current;
    const gMobs = globalKnownMobs.current;
    let dirty = false;

    const isGlobalMob = (name: string) => gMobs.has(name.toLowerCase());

    if (!pName) {
      pendingEvents.current.push(...events);
      console.log('[meter] Queuing', events.length, 'events (no player name yet, total queued:', pendingEvents.current.length + ')');
      return;
    }

    // Pre-scan: collect landing messages and charm landings BEFORE processing damage.
    // In EQ logs, landing messages appear AFTER the damage line at the same timestamp,
    // so we need them registered first for the correlator to use during attribution.
    for (const ev of events) {
      if (ev.type === 'spell_land') {
        corr.recordLanding(ev);
      } else if (ev.type === 'charm_land') {
        corr.processCharmLanding(ev.target, ev.timestamp);
      }
    }

    for (const ev of events) {
      // ── Session gap detection ──
      // If >15 min elapsed between consecutive log events, the player was
      // disconnected/crashed/logged out — start a fresh session.
      if (ev.timestamp > 0) {
        if (lastEventTimestamp.current > 0
            && ev.timestamp - lastEventTimestamp.current > SESSION_GAP_MS) {
          sessionStartId.current = fightSeq.current;
        }
        lastEventTimestamp.current = ev.timestamp;
      }

      // ── /who results → definitive class + level (highest confidence) ──
      if (ev.type === 'who_result') {
        if (ev.source) corr.addZonePlayer(ev.source);
        if (ev.skill && ev.skill !== 'ANONYMOUS') {
          const cls = detectClassFromWho(ev.skill);
          console.log('[WHO]', ev.source, ev.skill, '→', cls);
          if (cls && ev.source) {
            setEntityClass(ev.source, cls, DETECTION_CONFIDENCE['who_result']);
            classCandidates.current[ev.source] = new Set([cls]);
            updateColor(ev.source, cls);
            for (const f of all) {
              if (f.entities[ev.source]) f.entities[ev.source].eqClass = cls;
            }
            dirty = true;
          }
        }
        if (ev.source && ev.amount > 0) {
          entityLevelMap.current[ev.source] = ev.amount;
          if (ev.source === pName) {
            corr.setPlayerLevel(ev.amount);
          }
        }
        continue;
      }

      if (ev.type === 'discipline') {
        if (ev.skill.startsWith('_')) continue;
        const cls = ev.skill as EQClass;
        if (ev.source && CLASS_COLORS[cls]) {
          setEntityClass(ev.source, cls, DETECTION_CONFIDENCE['discipline']);
          classCandidates.current[ev.source] = new Set([cls]);
          updateColor(ev.source, cls);
          for (const f of all) {
            if (f.entities[ev.source]) f.entities[ev.source].eqClass = cls;
          }
          dirty = true;
        }
        continue;
      }

      // ── Buff landing (ambient info, not directly actionable yet) ──
      if (ev.type === 'buff_land') continue;

      // Landing messages are pre-scanned above for the correlator's pending
      // queue.  Additionally, try to attribute estimated damage for group
      // members' spells (EQ doesn't log their damage numbers, only the
      // landing text like "A mob is engulfed by fire.").
      if (ev.type === 'spell_land') {
        const estimated = corr.attributeLandingDirect(ev, entityLevelMap.current);
        if (estimated && estimated.amount > 0) {
          const tgtName = normalizeTarget(ev.target, pName);
          const fight = getOrCreateFight(all, ev.timestamp, true);
          if (fight) {
            fight.lastEventTime = ev.timestamp;
            resetCombatTimer();
            addMob(fight, tgtName);
            const label = estimated.spellName + ' (est.)';
            creditDamage(fight, estimated.source, tgtName, estimated.amount, label, false, false, clsMap, true);
            updateColor(estimated.source, clsMap[estimated.source] || null);
            dirty = true;
          }
        }
        continue;
      }
      if (ev.type === 'charm_land') continue;

      if (ev.type === 'charm_break') {
        corr.handleCharmBreak(ev.source);
        continue;
      }

      // ── Pet melee → track ownership, roll damage into owner ──
      if (ev.type === 'pet_melee') {
        const ownerName = ev.source;
        const petLabel = ownerName + '`s pet';
        petOwnerMap.current[petLabel] = ownerName;

        const fight = getOrCreateFight(all, ev.timestamp, true);
        if (!fight) continue;
        fight.lastEventTime = ev.timestamp;
        resetCombatTimer();

        const tgt = normalizeTarget(ev.target, pName);
        const petSkillLabel = 'Pet: ' + (ev.skill.charAt(0).toUpperCase() + ev.skill.slice(1));
        creditDamage(fight, ownerName, tgt, ev.amount, petSkillLabel, false, false, clsMap);
        updateColor(ownerName, clsMap[ownerName] || null);

        // Also record on the pet sub-entity for tooltip breakdown
        const petEntity = getEntity(fight, petLabel);
        petEntity.isPet = true;
        petEntity.petOwner = ownerName;
        petEntity.damageToMobs += ev.amount;
        petEntity.meleeDmg += ev.amount;
        petEntity.hits++;
        if (ev.amount > petEntity.maxHit) {
          petEntity.maxHit = ev.amount;
          petEntity.maxHitSkill = ev.skill;
        }
        recordAbility(petEntity, ev.skill.charAt(0).toUpperCase() + ev.skill.slice(1), ev.amount);
        dirty = true;
        continue;
      }

      // ── Spell correlation events ──
      if (ev.type === 'cast_start') {
        const candidates = getSpellCandidateClasses(ev.skill);
        if (candidates) {
          if (candidates.length === 1) {
            setEntityClass(pName, candidates[0], DETECTION_CONFIDENCE['spell_cast']);
          } else if (!clsMap[pName] || (classConfidence.current[pName] ?? 0) < DETECTION_CONFIDENCE['spell_cast']) {
            const existing = classCandidates.current[pName];
            if (existing) {
              const intersection = new Set<EQClass>();
              for (const c of candidates) {
                if (existing.has(c)) intersection.add(c);
              }
              if (intersection.size > 0) classCandidates.current[pName] = intersection;
            } else {
              classCandidates.current[pName] = new Set(candidates);
            }
            if (classCandidates.current[pName].size === 1) {
              const cls = [...classCandidates.current[pName]][0];
              setEntityClass(pName, cls, DETECTION_CONFIDENCE['spell_cast']);
            }
          }
        }
        corr.recordCastStart(ev);
        continue;
      }
      if (ev.type === 'other_cast_start') {
        corr.recordCastStart(ev);
        continue;
      }
      if (ev.type === 'cast_interrupted' || ev.type === 'cast_fizzle' || ev.type === 'cast_resist') {
        corr.recordCastFailure(ev.source);
        continue;
      }
      if (ev.type === 'cast_recovered') {
        // Player recovered from an interrupt — un-consume the cast we marked as failed
        corr.unConsumeLast(ev.source);
        continue;
      }

      // ── Group tracking ──
      if (ev.type === 'group_join') { corr.addGroupMember(ev.source); continue; }
      if (ev.type === 'group_leave') { corr.removeGroupMember(ev.source); continue; }
      if (ev.type === 'group_chat') { corr.addGroupMember(ev.source); continue; }

      if (ev.type === 'login') {
        trackerEpoch.current = ev.timestamp;
        corr.reset();
        corr.setPlayerName(pName);
        continue;
      }

      if (ev.type === 'zone_change') {
        corr.reset();
        corr.setPlayerName(pName);
        continue;
      }

      // ── DoT ticks (known source — bypass correlator) ──
      if (ev.type === 'dot_tick') {
        const dotSrc = normalizeSource(ev.source, pName);
        const dotTgt = normalizeTarget(ev.target, pName);

        if (dotSrc && dotSrc !== '') {
          // Player's own DoT hitting a mob
          const fight = getOrCreateFight(all, ev.timestamp, true);
          if (!fight) continue;
          fight.lastEventTime = ev.timestamp;
          resetCombatTimer();
          creditDamage(fight, dotSrc, dotTgt, ev.amount, ev.skill, false, true, clsMap, true);
          updateColor(dotSrc, clsMap[dotSrc] || null);
        } else {
          // Incoming DoT damage on the player
          const fight = getOrCreateFight(all, ev.timestamp, true);
          if (!fight) continue;
          fight.lastEventTime = ev.timestamp;
          resetCombatTimer();
          const e = getEntity(fight, dotTgt);
          e.damageTaken += ev.amount;
          updateColor(dotTgt, clsMap[dotTgt] || null);
        }
        dirty = true;
        continue;
      }

      if (!['melee_damage', 'spell_damage', 'miss', 'death', 'heal'].includes(ev.type)) continue;

      const src = normalizeSource(ev.source, pName);
      const tgt = normalizeTarget(ev.target, pName);

      const isDamageEvent = ev.type === 'melee_damage' || ev.type === 'spell_damage';
      const fight = getOrCreateFight(all, ev.timestamp, isDamageEvent);
      if (!fight) continue;
      fight.lastEventTime = ev.timestamp;

      if (ev.type !== 'heal') resetCombatTimer();

      // ── Melee damage ──
      if (ev.type === 'melee_damage') {
        const meleeCls = detectClassFromMelee(ev.skill);
        if (meleeCls && src) setEntityClass(src, meleeCls, DETECTION_CONFIDENCE['melee_infer']);

        if (src) {
          skillTracker.current.recordSkill(src, ev.skill);
          tryInferClassFromSkills(src);
        }

        corr.recordMeleeHit(ev);

        const skillLabel = ev.skill.charAt(0).toUpperCase() + ev.skill.slice(1);

        if (src === pName) {
          // Player's own melee — always credit
          creditDamage(fight, src, tgt, ev.amount, skillLabel, false, false, clsMap);
          updateColor(src, clsMap[src] || null);
        } else if (tgt === pName) {
          // Something hit the player — it's a mob (and charm may have broken)
          corr.inferCharmBreak(src, tgt, ev.timestamp);
          addMob(fight, src);
          const e = getEntity(fight, tgt);
          e.damageTaken += ev.amount;
          updateColor(tgt, clsMap[tgt] || null);
        } else if (isMob(fight, src) || isGlobalMob(src)) {
          // Known mob hitting someone — track damage taken (charm may have broken)
          corr.inferCharmBreak(src, tgt, ev.timestamp);
          addMob(fight, src);
          const e = getEntity(fight, tgt);
          e.damageTaken += ev.amount;
          updateColor(tgt, clsMap[tgt] || null);
          if (!isLikelyNPC(tgt)) corr.addZonePlayer(tgt);
        } else if (corr.isKnownOrZonePlayer(src)) {
          // Known group/zone player hitting something — credit them, target is mob
          if (!isMob(fight, tgt)) addMob(fight, tgt);
          creditDamage(fight, src, tgt, ev.amount, skillLabel, false, false, clsMap);
          updateColor(src, clsMap[src] || null);
        } else if (isPetName(src)) {
          // Named pet from the P99 pet name pool.
          // Always store under the pet's own entity first (deferred attribution).
          addMob(fight, tgt);
          const petEntity = getEntity(fight, src);
          petEntity.damageToMobs += ev.amount;
          petEntity.meleeDmg += ev.amount;
          petEntity.hits++;
          if (ev.amount > petEntity.maxHit) {
            petEntity.maxHit = ev.amount;
            petEntity.maxHitSkill = ev.skill;
          }
          recordAbility(petEntity, skillLabel, ev.amount);

          // Check for high-confidence owner (pet summon cast or prior link)
          const petOwner = corr.getConfirmedPetOwner(src, ev.timestamp);
          if (petOwner && !petEntity.isPet) {
            // First-time link: retroactively merge accumulated damage to owner
            retroactivelyAssignPet(all, src, petOwner, clsMap);
            updateColor(petOwner, clsMap[petOwner] || null);
          } else if (petEntity.isPet && petEntity.petOwner) {
            // Already linked — also credit owner in real-time
            const ownerLabel = 'Pet: ' + skillLabel;
            creditDamage(fight, petEntity.petOwner, tgt, ev.amount, ownerLabel, false, false, clsMap);
            updateColor(petEntity.petOwner, clsMap[petEntity.petOwner] || null);
          }
        } else if (!isLikelyNPC(src) && isLikelyNPC(tgt)) {
          // Player-looking name hitting an NPC-looking name — credit the player
          addMob(fight, tgt);
          creditDamage(fight, src, tgt, ev.amount, skillLabel, false, false, clsMap);
          updateColor(src, clsMap[src] || null);
          corr.addZonePlayer(src);
        } else if (!isLikelyNPC(src) && (isMob(fight, tgt) || isGlobalMob(tgt))) {
          // Player-looking name hitting a known mob (non-NPC-named mob)
          addMob(fight, tgt);
          creditDamage(fight, src, tgt, ev.amount, skillLabel, false, false, clsMap);
          updateColor(src, clsMap[src] || null);
          corr.addZonePlayer(src);
        } else if (isLikelyNPC(src)) {
          // NPC source — check if it's a charmed pet
          const charmOwner = corr.getCharmOwner(src, ev.timestamp);
          if (charmOwner && isLikelyNPC(tgt)) {
            addMob(fight, tgt);
            const charmLabel = 'Charm: ' + (ev.skill.charAt(0).toUpperCase() + ev.skill.slice(1));
            creditDamage(fight, charmOwner, tgt, ev.amount, charmLabel, false, false, clsMap);
            updateColor(charmOwner, clsMap[charmOwner] || null);
          } else {
            // NPC-on-NPC or NPC-on-player: register both as mobs
            addMob(fight, src);
            if (isLikelyNPC(tgt)) addMob(fight, tgt);
          }
        }
        dirty = true;
      }

      // ── Spell damage ──
      else if (ev.type === 'spell_damage') {
        const attributed = corr.attributeSpellDamage(ev);
        const attrSource = attributed.source;
        const targetIsMob = isMob(fight, tgt) || !corr.isKnownOrZonePlayer(tgt);

        if (targetIsMob) {
          addMob(fight, tgt);
          const label = attributed.isDamageShield ? 'Damage Shield'
            : attributed.isDoT ? 'DoT'
            : (attributed.spellName || 'Non-melee');
          creditDamage(fight, attrSource, tgt, ev.amount, label,
            attributed.isDamageShield, attributed.isDoT, clsMap, true);
          updateColor(attrSource, clsMap[attrSource] || null);
        } else {
          const e = getEntity(fight, tgt);
          e.damageTaken += ev.amount;
          updateColor(tgt, clsMap[tgt] || null);
        }
        dirty = true;
      }

      // ── Misses ──
      else if (ev.type === 'miss') {
        if (src === pName || corr.isKnownPlayer(src)) {
          if (!isMob(fight, tgt)) addMob(fight, tgt);
          const e = getEntity(fight, src);
          e.misses++;
          updateColor(src, clsMap[src] || null);
        } else if (isMob(fight, src)) {
          getEntity(fight, tgt);
          updateColor(tgt, clsMap[tgt] || null);
        } else if (!isLikelyNPC(src) && isLikelyNPC(tgt)) {
          addMob(fight, tgt);
          const e = getEntity(fight, src);
          e.misses++;
          updateColor(src, clsMap[src] || null);
          corr.addZonePlayer(src);
        } else if (!isLikelyNPC(src) && (isMob(fight, tgt) || isGlobalMob(tgt))) {
          addMob(fight, tgt);
          const e = getEntity(fight, src);
          e.misses++;
          updateColor(src, clsMap[src] || null);
          corr.addZonePlayer(src);
        }
        dirty = true;
      }

      // ── Deaths ──
      else if (ev.type === 'death') {
        addMob(fight, tgt);
        if (src) {
          const e = getEntity(fight, src);
          e.kills++;
          updateColor(src, clsMap[src] || null);
        }
        dirty = true;
      }

      // ── Healing ──
      else if (ev.type === 'heal') {
        const e = getEntity(fight, src);
        e.healingDone += ev.amount;
        updateColor(src, clsMap[src] || null);
        dirty = true;
      }
    }

    if (dirty) {
      for (const f of all) {
        for (const m of f.knownMobs) gMobs.add(m);
      }
      fightsRef.current = [...all];
      setFights([...all]);
      setEvtCount(c => c + events.length);
    }
  }, [updateColor, setEntityClass, resetCombatTimer, tryInferClassFromSkills]);

  // Keep processEventsRef in sync so setPlayerNameImmediate can drain queued events
  processEventsRef.current = processEvents;

  const reset = useCallback(() => {
    fightsRef.current = [];
    setFights([]);
    setEvtCount(0);
    fightSeq.current = 0;
    sessionStartId.current = 0;
    lastEventTimestamp.current = 0;
    trackerEpoch.current = Date.now();
    setFightIdx(-1);
    setInCombat(false);
    if (combatTimer.current) clearTimeout(combatTimer.current);
    correlator.current.fullReset();
    correlator.current.setPlayerName(playerNameRef.current);
    skillTracker.current.reset();
    petOwnerMap.current = {};
    // entityClassMap and colorMap are intentionally preserved across resets —
    // they represent persistent knowledge about character classes
  }, []);

  const assignPetOwner = useCallback((petName: string, ownerName: string) => {
    const all = fightsRef.current;
    const corr = correlator.current;
    corr.registerPet(petName, ownerName);
    retroactivelyAssignPet(all, petName, ownerName, entityClassMap.current);
    fightsRef.current = [...all];
    setFights([...all]);
  }, []);

  const getDisplayData = useCallback(() => {
    const empty = { players: [] as DisplayPlayer[], totalValue: 0, duration: 0, targetName: '', fightCount: fights.length };
    if (fights.length === 0) return empty;

    let merged: Record<string, EntityStats>;
    let start: number, end: number;
    let allMobNames: Record<string, string> = {};

    if (showMode === 'current') {
      // Show the most recent fight with actual data.
      // Skip fights from the initial backfill that ended well before the meter started —
      // prevents showing 12-hour-old data from the log tail on a fresh login.
      const staleThreshold = trackerEpoch.current - 120_000;
      let f: Fight | undefined;
      for (let i = fights.length - 1; i >= 0; i--) {
        const fight = fights[i];
        if (Object.keys(fight.entities).length === 0) continue;
        if (fight.ended && fight.lastEventTime < staleThreshold) break;
        f = fight;
        break;
      }
      if (!f) return empty;
      merged = {};
      for (const [k, v] of Object.entries(f.entities)) merged[k] = { ...v, abilities: { ...v.abilities } };
      allMobNames = f.mobNames;
      start = f.startTime;
      end = f.lastEventTime;
    } else if (fightIdx === -1) {
      merged = {};
      start = Infinity; end = 0;
      for (const f of fights) {
        if (f.id < sessionStartId.current) continue;
        for (const [k, v] of Object.entries(f.entities)) {
          merged[k] = merged[k] ? mergeEntity(merged[k], v) : { ...v };
        }
        Object.assign(allMobNames, f.mobNames);
        start = Math.min(start, f.startTime);
        end = Math.max(end, f.lastEventTime);
      }
    } else {
      const f = fights[fightIdx];
      if (!f) return empty;
      merged = {};
      for (const [k, v] of Object.entries(f.entities)) merged[k] = { ...v, abilities: { ...v.abilities } };
      allMobNames = f.mobNames;
      start = f.startTime;
      end = f.lastEventTime;
    }

    // Collect pet entities keyed by owner
    const petsByOwner: Record<string, EntityStats[]> = {};
    for (const ent of Object.values(merged)) {
      if (ent.isPet && ent.petOwner) {
        if (!petsByOwner[ent.petOwner]) petsByOwner[ent.petOwner] = [];
        petsByOwner[ent.petOwner].push(ent);
      }
    }

    const dur = end - start;
    const getValue = (e: EntityStats) => {
      switch (viewMode) {
        case 'damage': return e.damageToMobs;
        case 'healing': return e.healingDone;
        case 'damageTaken': return e.damageTaken;
      }
    };

    const sorted = Object.values(merged)
      .filter(e => getValue(e) > 0 && !(e.isPet && e.petOwner))
      .sort((a, b) => getValue(b) - getValue(a));
    const total = sorted.reduce((s, e) => s + getValue(e), 0);
    const topVal = sorted[0] ? getValue(sorted[0]) : 1;

    let targetName = '';
    for (const name of Object.values(allMobNames)) {
      if (!targetName) { targetName = name; break; }
    }

    const fmtDps = (v: number) => dur > 0 ? (v / (dur / 1000)).toFixed(1) : '0.0';

    return {
      players: sorted.map((e): DisplayPlayer => {
        const cls = entityClassMap.current[e.name] || e.eqClass;
        const totalAbilityDmg = e.damageToMobs || 1;
        const sortedAbilities = Object.values(e.abilities)
          .sort((a, b) => b.damage - a.damage)
          .map(a => ({
            name: a.name, damage: a.damage,
            pct: (a.damage / totalAbilityDmg) * 100,
            hits: a.hits, maxHit: a.maxHit,
          }));

        const pets: PetDisplayInfo[] = (petsByOwner[e.name] || []).map(pet => {
          const petTotal = pet.damageToMobs || 1;
          return {
            petName: pet.name, damage: pet.damageToMobs,
            abilities: Object.values(pet.abilities)
              .sort((a, b) => b.damage - a.damage)
              .map(a => ({
                name: a.name, damage: a.damage,
                pct: (a.damage / petTotal) * 100,
                hits: a.hits, maxHit: a.maxHit,
              })),
          };
        });

        return {
          name: e.name, eqClass: cls,
          classShort: cls ? CLASS_SHORT[cls] : '',
          value: getValue(e),
          pct: total > 0 ? (getValue(e) / total) * 100 : 0,
          barPct: (getValue(e) / topVal) * 100,
          color: colorMap.current[e.name] || UNKNOWN_COLOR,
          dps: fmtDps(getValue(e)),
          meleeDmg: e.meleeDmg, spellDmg: e.spellDmg,
          dsDmg: e.dsDmg, dotDmg: e.dotDmg,
          damageTaken: e.damageTaken,
          healingDone: e.healingDone, damageToMobs: e.damageToMobs,
          hits: e.hits, misses: e.misses, maxHit: e.maxHit, maxHitSkill: e.maxHitSkill,
          kills: e.kills,
          abilities: sortedAbilities,
          pets,
          isUnownedPet: isPetName(e.name) && !e.isPet,
        };
      }),
      totalValue: total,
      duration: dur,
      targetName,
      fightCount: fights.length,
    };
  }, [fights, fightIdx, viewMode, showMode]);

  const getSuggestedPetOwners = useCallback((): string[] => {
    return correlator.current.getSuggestedPetOwners();
  }, []);

  const resetSession = useCallback(() => {
    const all = fightsRef.current;
    sessionStartId.current = all.length > 0
      ? all[all.length - 1].id + 1
      : fightSeq.current;
    lastEventTimestamp.current = 0;
  }, []);

  return {
    fights, fightIdx, setFightIdx, viewMode, setViewMode,
    evtCount, processEvents, reset, getDisplayData,
    inCombat, showMode, setShowMode, seedClassDb, seedSpellDb, seedLandingMap,
    assignPetOwner, getSuggestedPetOwners, setPlayerNameImmediate,
    resetSession,
  };
}
