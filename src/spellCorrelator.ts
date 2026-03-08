import type { CombatEvent } from './logParser';
import type { EQClass } from './eqClasses';
import type { SpellInfo, LandingSpellInfo } from './spellDatabase';
import { calcExpectedDamage } from './spellDatabase';
import { isPetName, PET_SUMMON_SPELLS, PET_CLASSES } from './petData';
import {
  MAX_CAST_WINDOW_MS, MIN_CAST_TIME_MS, DS_WINDOW_MS, DS_MAX_DAMAGE,
  DOT_TICK_INTERVAL_MS, DOT_TICK_TOLERANCE_MS, PROC_WINDOW_MS, PROC_MAX_DAMAGE,
  LANDING_EXPIRY_MS, LANDING_MATCH_WINDOW_MS,
  CAST_EARLY_TOLERANCE_MS, CAST_LATE_TOLERANCE_MS,
  DMG_TOLERANCE_TIGHT, DMG_TOLERANCE_WIDE, DMG_TOLERANCE_FLOOR,
  MAX_PENDING_CASTS, MAX_RECENT_MELEE_HITS, MAX_DOT_TRACKERS, MAX_PENDING_LANDINGS,
  SCORE_PLAYER_LANDING, SCORE_PLAYER_CAST_DB, SCORE_GROUP_LANDING,
  SCORE_OTHER_LANDING, SCORE_PLAYER_CAST_NOBD, SCORE_GROUP_CAST,
  SCORE_GROUP_LANDING_NOCAST, SCORE_OTHER_LANDING_NOCAST,
  SCORE_UNKNOWN_MOB_HIT, SCORE_MOB_HIT_PLAYER,
  CONFIDENCE_HIGH_THRESHOLD, CONFIDENCE_MEDIUM_THRESHOLD,
  LABEL_NONMELEE, LABEL_DAMAGE_SHIELD, LABEL_DOT, LABEL_PROC, LABEL_OTHERS_SPELLS,
  CHARM_SPELL_NAMES, CHARM_MAX_DURATION_MS,
  isLikelyNPC, normalizeSource, normalizeTarget,
} from './constants';

let nextCastId = 1;

interface PendingCast {
  id: number;
  caster: string;
  timestamp: number;
  spellName: string;  // only populated for "You", empty for others
  consumed: boolean;
  consumedAt?: number;
  expectedBaseDmg?: number;
  expectedMaxDmg?: number;
  expectedCastMs?: number;
  expectedExactDmg?: number;
  isNonDamage?: boolean;
}

interface RecentMeleeHit {
  source: string;
  target: string;
  timestamp: number;
}

interface DoTTracker {
  target: string;
  amount: number;
  lastTick: number;
  tickCount: number;
  attributedTo: string;
}

interface PendingLanding {
  target: string;        // normalized (lowercase) target name
  targetRaw: string;     // original casing from the landing message
  spellName: string;     // primary spell name (first candidate)
  allSpells: LandingSpellInfo[];  // all candidate spells sharing this landing message
  baseDmg: number;
  maxDmg: number;
  castMs: number;
  timestamp: number;
}

export interface AttributedSpellDamage {
  source: string;
  target: string;
  amount: number;
  isDamageShield: boolean;
  isDoT: boolean;
  spellName: string;
  confidence: 'high' | 'medium' | 'low';
}

interface CharmedMob {
  owner: string;
  mobName: string;        // original casing
  charmedAt: number;
}

export class SpellCorrelator {
  private pendingCasts: PendingCast[] = [];
  private recentMeleeHits: RecentMeleeHit[] = [];
  private dotTrackers: DoTTracker[] = [];
  private pendingLandings: PendingLanding[] = [];
  private groupMembers = new Set<string>();
  private entityClassMap: Record<string, EQClass> = {};
  private playerName = '';
  private playerLevel = 0;
  private spellDb: Record<string, SpellInfo> = {};
  private landingMap: Record<string, LandingSpellInfo[]> = {};
  // Charm tracking: lowercase mob name → charm info
  private charmedMobs = new Map<string, CharmedMob>();
  private pendingCharmCaster: string | null = null;
  private pendingCharmTimestamp = 0;
  // Named pet tracking: lowercase pet name → owner name
  private knownPets = new Map<string, string>();
  // When a player casts a pet summon spell, store pending summon
  private pendingPetSummon: { caster: string; timestamp: number } | null = null;

  setPlayerName(name: string) {
    this.playerName = name;
  }

  setPlayerLevel(level: number) {
    this.playerLevel = level;
  }

  setSpellDb(db: Record<string, SpellInfo>) {
    this.spellDb = db;
  }

  setLandingMap(map: Record<string, LandingSpellInfo[]>) {
    this.landingMap = map;
  }

  addGroupMember(name: string) {
    this.groupMembers.add(name);
  }

  removeGroupMember(name: string) {
    this.groupMembers.delete(name);
  }

  setEntityClassMap(map: Record<string, EQClass>) {
    this.entityClassMap = map;
  }

  isKnownPlayer(name: string): boolean {
    return name === this.playerName || this.groupMembers.has(name);
  }

  // ── Named pet tracking ──

  /**
   * Register a named pet (from the P99 name pool) as belonging to an owner.
   */
  registerPet(petName: string, owner: string) {
    this.knownPets.set(petName.toLowerCase(), owner);
  }

  /**
   * Returns the confirmed owner of a named pet, or null.
   * Only returns high-confidence links: explicit registration (via pet summon
   * cast detection or manual assignment). Does NOT auto-link on weak signals
   * like "only one pet class in group" — that's left to the user via the UI.
   */
  getConfirmedPetOwner(name: string, timestamp: number): string | null {
    const key = name.toLowerCase();

    const existing = this.knownPets.get(key);
    if (existing) return existing;

    if (!isPetName(name)) return null;

    // High-confidence: player just cast a pet summon spell
    if (this.pendingPetSummon &&
        (timestamp - this.pendingPetSummon.timestamp) < MAX_CAST_WINDOW_MS * 2) {
      const owner = this.pendingPetSummon.caster;
      this.registerPet(name, owner);
      this.pendingPetSummon = null;
      return owner;
    }

    return null;
  }

  /**
   * Returns likely pet class players from the group, used as suggestions
   * in the "assign pet owner" context menu.
   */
  getSuggestedPetOwners(): string[] {
    return this.findPetClassPlayers();
  }

  /**
   * Check if a name matches the P99 pet name pool (without requiring owner).
   */
  isRecognizedPetName(name: string): boolean {
    return isPetName(name);
  }

  private findPetClassPlayers(): string[] {
    const result: string[] = [];
    const checkPlayer = (name: string) => {
      const cls = this.entityClassMap[name];
      if (cls && PET_CLASSES.has(cls)) result.push(name);
    };
    checkPlayer(this.playerName);
    for (const member of this.groupMembers) {
      checkPlayer(member);
    }
    return result;
  }

  // ── Charm tracking ──

  /**
   * Check if a charm spell was just cast. Called from useCombatTracker
   * when a cast_start event matches a known charm spell name.
   */
  recordCharmCast(caster: string, timestamp: number) {
    this.pendingCharmCaster = caster;
    this.pendingCharmTimestamp = timestamp;
  }

  /**
   * Register a mob as charmed. Called when a charm_land event is detected,
   * or inferred from the player casting a charm + NPC behavior change.
   */
  registerCharmedMob(mobName: string, owner: string, timestamp: number) {
    const key = mobName.toLowerCase();
    this.charmedMobs.set(key, { owner, mobName, charmedAt: timestamp });
    this.pendingCharmCaster = null;
  }

  /**
   * Handle a charm landing event. Try to find who cast the charm by
   * correlating with recent pending casts.
   */
  processCharmLanding(target: string, timestamp: number) {
    // If we have a pending charm cast, use that
    if (this.pendingCharmCaster && (timestamp - this.pendingCharmTimestamp) < MAX_CAST_WINDOW_MS) {
      this.registerCharmedMob(target, this.pendingCharmCaster, timestamp);
      return;
    }

    // Otherwise, try to find a recent cast from a known player
    // (charm spells are 2-6 seconds cast time)
    for (let i = this.pendingCasts.length - 1; i >= 0; i--) {
      const cast = this.pendingCasts[i];
      if (cast.consumed) continue;
      const elapsed = timestamp - cast.timestamp;
      if (elapsed < 0 || elapsed > MAX_CAST_WINDOW_MS) continue;
      if (!this.isKnownPlayer(cast.caster)) continue;
      // For the player's own casts, verify it's a charm spell
      if (cast.caster === this.playerName && cast.spellName) {
        if (!CHARM_SPELL_NAMES.has(cast.spellName.toLowerCase())) continue;
      }
      cast.consumed = true;
      this.registerCharmedMob(target, cast.caster, timestamp);
      return;
    }

    // Last resort: if the player had ANY pending charm cast, attribute to them
    if (this.playerName) {
      this.registerCharmedMob(target, this.playerName, timestamp);
    }
  }

  /**
   * Handle charm break. Remove the mob from tracking.
   * For "Your charm spell has worn off" we remove the player's charmed mob.
   */
  handleCharmBreak(caster: string) {
    const name = normalizeSource(caster, this.playerName);
    for (const [key, info] of this.charmedMobs) {
      if (info.owner === name) {
        this.charmedMobs.delete(key);
        return;
      }
    }
  }

  /**
   * Check if an NPC is a charmed pet. Returns the owner name or null.
   * Also prunes expired charms.
   */
  getCharmOwner(npcName: string, now: number): string | null {
    const key = npcName.toLowerCase();
    const info = this.charmedMobs.get(key);
    if (!info) return null;
    if (now - info.charmedAt > CHARM_MAX_DURATION_MS) {
      this.charmedMobs.delete(key);
      return null;
    }
    return info.owner;
  }

  /**
   * If a known charmed mob hits a player, charm has broken.
   */
  inferCharmBreak(attackerNpc: string, targetPlayer: string, now: number) {
    if (!this.isKnownPlayer(targetPlayer)) return;
    const key = attackerNpc.toLowerCase();
    if (this.charmedMobs.has(key)) {
      this.charmedMobs.delete(key);
    }
  }

  recordCastStart(ev: CombatEvent) {
    const caster = normalizeSource(ev.source, this.playerName);
    if (!caster) return;

    if (caster !== this.playerName && isLikelyNPC(caster)) return;

    const cast: PendingCast = {
      id: nextCastId++,
      caster,
      timestamp: ev.timestamp,
      spellName: ev.skill || '',
      consumed: false,
    };

    if (caster === this.playerName && ev.skill) {
      const spellKey = ev.skill.toLowerCase();
      if (CHARM_SPELL_NAMES.has(spellKey)) {
        this.recordCharmCast(caster, ev.timestamp);
        cast.isNonDamage = true;
      }
      if (PET_SUMMON_SPELLS.has(spellKey)) {
        this.pendingPetSummon = { caster, timestamp: ev.timestamp };
        cast.isNonDamage = true;
      }
      const info = this.spellDb[spellKey];
      if (info) {
        cast.expectedBaseDmg = info.baseDmg;
        cast.expectedMaxDmg = info.maxDmg;
        cast.expectedCastMs = info.castMs;
        if (info.baseDmg === 0) cast.isNonDamage = true;
        if (this.playerLevel > 0 && info.baseDmg > 0) {
          const exact = calcExpectedDamage(info, this.playerLevel);
          if (exact > 0) cast.expectedExactDmg = exact;
        }
      }
    }

    this.pendingCasts.push(cast);
    // Time-based pruning + hard cap
    this.pendingCasts = this.pendingCasts.filter(
      c => ev.timestamp - c.timestamp < MAX_CAST_WINDOW_MS * 2
    );
    if (this.pendingCasts.length > MAX_PENDING_CASTS) {
      this.pendingCasts = this.pendingCasts.slice(-MAX_PENDING_CASTS);
    }
  }

  recordLanding(ev: CombatEvent) {
    // ev.skill contains the raw landing suffix (e.g. " staggers." or "'s skin freezes.")
    const suffix = ev.skill?.toLowerCase();
    if (!suffix) return;

    const spells = this.landingMap[suffix];
    if (!spells || spells.length === 0) return;

    const spell = spells[0];
    const maxDmgAcrossAll = Math.max(...spells.map(s => s.maxDmg || s.baseDmg));
    this.pendingLandings.push({
      target: ev.target.toLowerCase(),
      targetRaw: ev.target,
      spellName: spell.spellName,
      allSpells: spells,
      baseDmg: spell.baseDmg,
      maxDmg: maxDmgAcrossAll,
      castMs: spell.castMs,
      timestamp: ev.timestamp,
    });

    this.pendingLandings = this.pendingLandings.filter(
      l => ev.timestamp - l.timestamp < LANDING_EXPIRY_MS
    );
    if (this.pendingLandings.length > MAX_PENDING_LANDINGS) {
      this.pendingLandings = this.pendingLandings.slice(-MAX_PENDING_LANDINGS);
    }
  }

  unConsumeLast(casterName: string) {
    const name = normalizeSource(casterName, this.playerName);
    for (let i = this.pendingCasts.length - 1; i >= 0; i--) {
      if (this.pendingCasts[i].caster === name && this.pendingCasts[i].consumed) {
        this.pendingCasts[i].consumed = false;
        return;
      }
    }
  }

  recordCastFailure(casterName: string) {
    const name = normalizeSource(casterName, this.playerName);
    for (let i = this.pendingCasts.length - 1; i >= 0; i--) {
      if (this.pendingCasts[i].caster === name && !this.pendingCasts[i].consumed) {
        this.pendingCasts[i].consumed = true;
        return;
      }
    }
  }

  recordMeleeHit(ev: CombatEvent) {
    this.recentMeleeHits.push({
      source: normalizeSource(ev.source, this.playerName),
      target: normalizeTarget(ev.target, this.playerName),
      timestamp: ev.timestamp,
    });
    this.recentMeleeHits = this.recentMeleeHits.filter(
      h => ev.timestamp - h.timestamp < Math.max(DS_WINDOW_MS, PROC_WINDOW_MS) * 3
    );
    if (this.recentMeleeHits.length > MAX_RECENT_MELEE_HITS) {
      this.recentMeleeHits = this.recentMeleeHits.slice(-MAX_RECENT_MELEE_HITS);
    }
  }

  attributeSpellDamage(ev: CombatEvent): AttributedSpellDamage {
    const target = ev.target;
    const amount = ev.amount;
    const now = ev.timestamp;
    const targetIsMob = !this.isKnownPlayer(target);

    // ── 1. Damage Shield Detection ──
    if (amount <= DS_MAX_DAMAGE && targetIsMob) {
      const dsHit = this.recentMeleeHits.find(
        h => h.source === target && (now - h.timestamp) <= DS_WINDOW_MS
      );
      if (dsHit) {
        return {
          source: dsHit.target,
          target, amount,
          isDamageShield: true, isDoT: false,
          spellName: LABEL_DAMAGE_SHIELD,
          confidence: 'high',
        };
      }
    }

    // ── 2. DoT Tick Detection ──
    // Prune stale trackers (no tick in 30s = 5 missed ticks, DoT likely expired)
    const DOT_EXPIRY_MS = 30_000;
    this.dotTrackers = this.dotTrackers.filter(d => now - d.lastTick < DOT_EXPIRY_MS);

    for (const dot of this.dotTrackers) {
      if (dot.target === target && dot.amount === amount) {
        const elapsed = now - dot.lastTick;
        if (Math.abs(elapsed - DOT_TICK_INTERVAL_MS) < DOT_TICK_TOLERANCE_MS) {
          dot.lastTick = now;
          dot.tickCount++;
          return {
            source: dot.attributedTo,
            target, amount,
            isDamageShield: false, isDoT: true,
            spellName: LABEL_DOT,
            confidence: dot.tickCount >= 2 ? 'high' : 'medium',
          };
        }
      }
    }

    // ── 3. Landing Message + Cast Correlation ──
    // Check if a landing message appeared at the same timestamp for this target.
    // Landing messages tell us WHICH spell hit, enabling precise cast matching.
    const targetLower = target.toLowerCase();
    const landing = this.pendingLandings.find(
      l => l.target === targetLower && Math.abs(now - l.timestamp) <= LANDING_MATCH_WINDOW_MS
    );

    if (landing) {
      // We know the spell name — find a matching pending cast
      const landingResult = this.attributeWithLanding(landing, target, amount, now, targetIsMob);
      if (landingResult) {
        // Consume the landing
        this.pendingLandings = this.pendingLandings.filter(l => l !== landing);
        return landingResult;
      }
    }

    // ── 4. Spell Cast Correlation (without landing message) ──
    const castResult = this.attributeFromCasts(target, amount, now, targetIsMob);
    if (castResult) return castResult;

    // ── 5. Weapon Proc Detection (after spell correlation to avoid stealing small nukes) ──
    if (targetIsMob && amount <= PROC_MAX_DAMAGE) {
      const procHit = this.recentMeleeHits.find(
        h => h.target === target &&
             this.isKnownPlayer(h.source) &&
             (now - h.timestamp) <= PROC_WINDOW_MS
      );
      if (procHit) {
        return {
          source: procHit.source,
          target, amount,
          isDamageShield: false, isDoT: false,
          spellName: LABEL_PROC,
          confidence: 'high',
        };
      }
    }

    // ── 6. No correlation found ──
    if (targetIsMob && this.playerName) {
      const hasRecentPlayerCast = this.pendingCasts.some(
        c => c.caster === this.playerName && !c.consumed && !c.isNonDamage &&
             (now - c.timestamp) < MAX_CAST_WINDOW_MS * 2
      );
      if (hasRecentPlayerCast) {
        this.maybeStartDoTTracker(target, amount, now, this.playerName);
        return {
          source: this.playerName,
          target, amount,
          isDamageShield: false, isDoT: false,
          spellName: LABEL_NONMELEE,
          confidence: 'low',
        };
      }
    }

    this.maybeStartDoTTracker(target, amount, now, LABEL_OTHERS_SPELLS);
    return {
      source: LABEL_OTHERS_SPELLS,
      target, amount,
      isDamageShield: false, isDoT: false,
      spellName: LABEL_NONMELEE,
      confidence: 'low',
    };
  }

  /**
   * Attribute damage when we have a landing message identifying the spell.
   * The landing message tells us the spell name, so we can:
   * - For the player's own casts: confirm the spell matches our pending cast
   * - For other players: use spell cast time to find the right "begins to cast" entry
   */
  private attributeWithLanding(
    landing: PendingLanding, target: string, amount: number,
    now: number, targetIsMob: boolean,
  ): AttributedSpellDamage | null {
    if (landing.baseDmg > 0 && amount > landing.maxDmg * (1 + DMG_TOLERANCE_WIDE)) {
      return null;
    }
    // Level-aware: if we know the player's level, calculate exact expected damage
    // from the spell DB for tighter validation against this landing
    let landingExactDmg = 0;
    if (this.playerLevel > 0) {
      const spellInfo = this.spellDb[landing.spellName.toLowerCase()];
      if (spellInfo && spellInfo.baseDmg > 0) {
        landingExactDmg = calcExpectedDamage(spellInfo, this.playerLevel);
      }
    }

    // Try to find a matching pending cast
    // Allow re-matching casts consumed within 500ms (AoE/rain spells hit multiple targets)
    const AOE_REUSE_WINDOW_MS = 500;
    let bestCast: PendingCast | null = null;
    let bestScore = -1;

    for (const cast of this.pendingCasts) {
      if (cast.consumed) {
        if (!cast.consumedAt || (now - cast.consumedAt) > AOE_REUSE_WINDOW_MS) continue;
      }
      const elapsed = now - cast.timestamp;

      // For player's own casts, verify spell name matches ANY candidate for this landing
      if (cast.caster === this.playerName && cast.spellName) {
        const castKey = cast.spellName.toLowerCase();
        const matchedSpell = landing.allSpells.find(
          s => s.spellName.toLowerCase() === castKey
        );
        if (!matchedSpell) continue;
        if (elapsed < matchedSpell.castMs - CAST_EARLY_TOLERANCE_MS) continue;
        if (elapsed > matchedSpell.castMs + CAST_LATE_TOLERANCE_MS) continue;

        // Spell name + timing already matched — use damage only as a scoring
        // bonus, not a hard filter. Focus items can increase damage well
        // beyond the base formula, so tight damage validation would reject
        // legitimate matches.
        let exactDmg = landingExactDmg;
        if (this.playerLevel > 0 && matchedSpell.baseDmg > 0) {
          exactDmg = calcExpectedDamage(matchedSpell, this.playerLevel);
        }
        const timingDelta = Math.abs(elapsed - matchedSpell.castMs);
        let score = SCORE_PLAYER_LANDING - (timingDelta / CAST_LATE_TOLERANCE_MS) * 50;
        if (exactDmg > 0) {
          const ratio = amount / exactDmg;
          if (ratio >= (1 - DMG_TOLERANCE_TIGHT) && ratio <= (1 + DMG_TOLERANCE_TIGHT)) {
            score += 50;
          }
        }
        if (score > bestScore) { bestScore = score; bestCast = cast; }
      }
      else if (!isLikelyNPC(cast.caster)) {
        const anyCastMs = landing.allSpells.find(s => s.castMs > 0)?.castMs || landing.castMs;
        if (anyCastMs > 0) {
          if (elapsed < anyCastMs - CAST_EARLY_TOLERANCE_MS) continue;
          if (elapsed > anyCastMs + CAST_LATE_TOLERANCE_MS) continue;
          const timingDelta = Math.abs(elapsed - anyCastMs);
          const isGroupMember = this.isKnownPlayer(cast.caster);
          const base = isGroupMember ? SCORE_GROUP_LANDING : SCORE_OTHER_LANDING;
          const score = base - (timingDelta / CAST_LATE_TOLERANCE_MS) * 50;
          if (score > bestScore) { bestScore = score; bestCast = cast; }
        } else {
          if (elapsed < MIN_CAST_TIME_MS || elapsed > MAX_CAST_WINDOW_MS) continue;
          const isGroupMember = this.isKnownPlayer(cast.caster);
          const score = (isGroupMember ? SCORE_GROUP_LANDING_NOCAST : SCORE_OTHER_LANDING_NOCAST) - (elapsed / MAX_CAST_WINDOW_MS) * 30;
          if (score > bestScore) { bestScore = score; bestCast = cast; }
        }
      }
    }

    if (bestCast) {
      this.consumeCastById(bestCast.id, now);

      const resolvedName = bestCast.spellName || landing.spellName;
      this.maybeStartDoTTracker(target, amount, now, bestCast.caster);
      return {
        source: bestCast.caster,
        target, amount,
        isDamageShield: false, isDoT: false,
        spellName: resolvedName,
        confidence: 'high',
      };
    }

    // Landing message matched but no pending cast found.
    // If the player was casting recently, tentatively attribute to them.
    if (targetIsMob && this.playerName) {
      const recentPlayerCast = this.pendingCasts.find(
        c => c.caster === this.playerName && !c.consumed &&
             (now - c.timestamp) < MAX_CAST_WINDOW_MS
      );
      if (recentPlayerCast) {
        this.maybeStartDoTTracker(target, amount, now, this.playerName);
        return {
          source: this.playerName,
          target, amount,
          isDamageShield: false, isDoT: false,
          spellName: landing.spellName,
          confidence: 'medium',
        };
      }
    }

    return null;
  }

  /**
   * Original cast-only correlation (no landing message).
   * Used as fallback when no landing message matched.
   */
  private attributeFromCasts(
    target: string, amount: number, now: number, targetIsMob: boolean,
  ): AttributedSpellDamage | null {
    const candidates: (PendingCast & { score: number })[] = [];

    const AOE_REUSE_WINDOW_MS = 500;
    for (const cast of this.pendingCasts) {
      if (cast.consumed) {
        if (!cast.consumedAt || (now - cast.consumedAt) > AOE_REUSE_WINDOW_MS) continue;
      }
      if (cast.isNonDamage) continue;
      const elapsed = now - cast.timestamp;

      let score = 0;

      if (cast.caster === this.playerName && cast.expectedCastMs !== undefined) {
        if (elapsed < cast.expectedCastMs - CAST_EARLY_TOLERANCE_MS) continue;
        if (elapsed > cast.expectedCastMs + CAST_LATE_TOLERANCE_MS) continue;

        if (cast.expectedBaseDmg && cast.expectedBaseDmg > 0) {
          // Hard cap: reject truly absurd damage (focus items cap around +60%)
          const maxAcceptable = (cast.expectedMaxDmg || cast.expectedBaseDmg) * (1 + DMG_TOLERANCE_WIDE);
          if (amount > maxAcceptable) continue;
          // Hard floor: reject if damage is far below expected (wrong spell)
          if (amount < cast.expectedBaseDmg * (1 - DMG_TOLERANCE_FLOOR)) continue;

          const timingDelta = Math.abs(elapsed - cast.expectedCastMs);
          score = SCORE_PLAYER_CAST_DB - (timingDelta / CAST_LATE_TOLERANCE_MS) * 50;

          // Tight damage match earns bonus score (helps disambiguation)
          if (cast.expectedExactDmg && cast.expectedExactDmg > 0) {
            const ratio = amount / cast.expectedExactDmg;
            if (ratio >= (1 - DMG_TOLERANCE_TIGHT) && ratio <= (1 + DMG_TOLERANCE_TIGHT)) {
              score += 50;
            }
          }
        } else {
          continue;
        }
      }
      else if (cast.caster === this.playerName) {
        if (elapsed < MIN_CAST_TIME_MS || elapsed > MAX_CAST_WINDOW_MS) continue;
        score = SCORE_PLAYER_CAST_NOBD - (elapsed / MAX_CAST_WINDOW_MS) * 50;
      }
      else if (this.isKnownPlayer(cast.caster)) {
        if (elapsed < MIN_CAST_TIME_MS || elapsed > MAX_CAST_WINDOW_MS) continue;
        score = SCORE_GROUP_CAST - (elapsed / MAX_CAST_WINDOW_MS) * 50;
      }
      else if (targetIsMob && isLikelyNPC(cast.caster)) {
        continue;
      }
      else if (targetIsMob) {
        if (elapsed < MIN_CAST_TIME_MS || elapsed > MAX_CAST_WINDOW_MS) continue;
        score = SCORE_UNKNOWN_MOB_HIT - (elapsed / MAX_CAST_WINDOW_MS) * 15;
      }
      else {
        if (elapsed < MIN_CAST_TIME_MS || elapsed > MAX_CAST_WINDOW_MS) continue;
        score = SCORE_MOB_HIT_PLAYER - (elapsed / MAX_CAST_WINDOW_MS) * 30;
      }

      candidates.push({ ...cast, score });
    }

    candidates.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

    if (candidates.length > 0) {
      const best = candidates[0];
      this.consumeCastById(best.id, now);

      const confidence = best.score >= CONFIDENCE_HIGH_THRESHOLD ? 'high'
        : best.score >= CONFIDENCE_MEDIUM_THRESHOLD ? 'medium' : 'low';
      this.maybeStartDoTTracker(target, amount, now, best.caster);
      return {
        source: best.caster, target, amount,
        isDamageShield: false, isDoT: false,
        spellName: best.spellName || LABEL_NONMELEE,
        confidence,
      };
    }

    return null;
  }

  private consumeCastById(id: number, timestamp?: number) {
    const cast = this.pendingCasts.find(c => c.id === id);
    if (cast) {
      cast.consumed = true;
      if (timestamp) cast.consumedAt = timestamp;
    }
  }

  private maybeStartDoTTracker(target: string, amount: number, timestamp: number, source: string) {
    const existing = this.dotTrackers.find(d => d.target === target && d.amount === amount);
    if (existing) {
      if (existing.attributedTo === LABEL_OTHERS_SPELLS && source !== LABEL_OTHERS_SPELLS) {
        existing.attributedTo = source;
      }
      return;
    }
    this.dotTrackers.push({
      target, amount, lastTick: timestamp, tickCount: 1, attributedTo: source,
    });
    if (this.dotTrackers.length > MAX_DOT_TRACKERS) this.dotTrackers.shift();
  }

  reset() {
    this.pendingCasts = [];
    this.recentMeleeHits = [];
    this.dotTrackers = [];
    this.pendingLandings = [];
    this.charmedMobs.clear();
    this.pendingCharmCaster = null;
    this.pendingPetSummon = null;
    // groupMembers, knownPets, playerName, playerLevel, spellDb, landingMap,
    // entityClassMap are intentionally preserved — they represent persistent
    // identity/reference data that survives zone changes
  }

  fullReset() {
    this.reset();
    this.groupMembers.clear();
    this.knownPets.clear();
  }
}
