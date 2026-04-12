export type CombatEventType =
  | 'melee_damage'
  | 'spell_damage'
  | 'dot_tick'           // "X has taken Y damage from your SpellName." (DoT with known source)
  | 'miss'
  | 'death'
  | 'heal'
  | 'cast_start'         // "You begin casting X."
  | 'other_cast_start'   // "Damoth begins to cast a spell."
  | 'cast_interrupted'   // "Your spell is interrupted." / "Nhuurgar's casting is interrupted!"
  | 'cast_fizzle'        // "Your spell fizzles!" / "Damoth's spell fizzles!"
  | 'cast_resist'        // "Your spell did not take hold." (full resist)
  | 'cast_recovered'     // "You regain your concentration and continue your casting."
  | 'spell_land'         // Spell landing message matched from spells_us.txt
  | 'charm_land'         // Charm spell landing detected (target = charmed mob)
  | 'charm_break'        // Charm worn off ("Your charm spell has worn off.")
  | 'group_join'         // "Fluphy has joined the group."
  | 'group_leave'        // "Fluphy has left the group."
  | 'group_chat'         // "Fluphy tells the group, '...'"
  | 'login'              // "Welcome to EverQuest!" — fresh login (not zoning)
  | 'zone_change'
  | 'who_result'         // "[55 Wizard] Soandso (High Elf) <Guild>"
  | 'buff_land'          // Spell-effect landing messages that imply caster class
  | 'discipline'         // Class-specific discipline activations
  | 'pet_melee'          // "Soandso's pet hits Mob for X damage"
  | 'player_location';   // "Your Location is X, Y, Z" (/loc output)

export interface CombatEvent {
  timestamp: number;
  type: CombatEventType;
  source: string;
  target: string;
  amount: number;
  skill: string;
  location?: { x: number; y: number; z: number };
}

import { TIMESTAMP_RE } from './constants';

const MELEE_VERBS_1P = 'crush|hit|slash|pierce|bash|kick|punch|backstab|maul|claw|gore|strike|smash|bite|slam|frenzy';
const MELEE_VERBS_3P = 'crushes|hits|slashes|pierces|bashes|kicks|punches|backstabs|mauls|claws|gores|strikes|smashes|bites|slams|frenzies';

const VERB_3P_TO_1P: Record<string, string> = {
  crushes: 'crush', hits: 'hit', slashes: 'slash', pierces: 'pierce',
  bashes: 'bash', kicks: 'kick', punches: 'punch', backstabs: 'backstab',
  mauls: 'maul', claws: 'claw', gores: 'gore', strikes: 'strike',
  smashes: 'smash', bites: 'bite', slams: 'slam', frenzies: 'frenzy',
};

const YOU_MELEE_RE = new RegExp(
  `^You (${MELEE_VERBS_1P}) (.+?) for (\\d+) points? of damage\\.$`
);
const OTHER_MELEE_RE = new RegExp(
  `^(.+?) (${MELEE_VERBS_3P}) (.+?) for (\\d+) points? of damage\\.$`
);
const NONMELEE_RE = /^(.+?) was hit by non-melee for (\d+) points? of damage\.$/;
const YOU_MISS_RE = new RegExp(
  `^You try to (${MELEE_VERBS_1P}) (.+?), but miss!$`
);
const OTHER_MISS_RE = new RegExp(
  `^(.+?) tries to (?:${MELEE_VERBS_1P}) (.+?), but misses!$`
);
const SLAIN_BY_RE = /^(.+?) has been slain by (.+?)!$/;
const YOU_SLAIN_RE = /^You have slain (.+?)!$/;
const YOU_SLAIN_BY_RE = /^You have been slain by (.+?)!$/;
const HEAL_RECEIVED_RE = /^(.+?) has healed you for (\d+) points? of damage\.$/;
const HEAL_DONE_RE = /^You have healed (.+?) for (\d+) points? of damage\.$/;
// DoT tick: "target has taken X damage from your SpellName."
const DOT_YOUR_RE = /^(.+?) has taken (\d+) damage from your (.+?)\.$/;
// Incoming DoT: "You have taken X damage from SpellName."
const DOT_INCOMING_RE = /^You have taken (\d+) damage from (.+?)\.$/;

const CAST_RE = /^You begin casting (.+?)\.$/;
const OTHER_CAST_RE = /^(.+?) begins to cast a spell\.$/;
const YOUR_INTERRUPT_RE = /^Your spell is interrupted\.$/;
const OTHER_INTERRUPT_RE = /^(.+?)'s casting is interrupted!$/;
const YOUR_FIZZLE_RE = /^Your spell fizzles!$/;
const OTHER_FIZZLE_RE = /^(.+?)'s spell fizzles!$/;
const SPELL_NO_HOLD_RE = /^Your spell did not take hold\.$/;
const SPELL_RECOVERED_RE = /^You regain your concentration and continue your casting\.$/;
const CHARM_BREAK_RE = /^Your charm spell has worn off\.$/;
const GROUP_JOIN_RE = /^(.+?) has joined the group\.$/;
const GROUP_LEAVE_RE = /^(.+?) has left the group\.$/;
const YOU_GROUP_JOIN_RE = /^You have joined the group\.$/;
const YOU_GROUP_LEAVE_RE = /^You have left the group\.$/;
const GROUP_CHAT_RE = /^(.+?) tells the group, '.*'$/;
const ZONE_RE = /^You have entered (.+?)\.$/;
const WHO_ZONE_RE = /^There (?:are|is) \d+ players? in (.+?)\.$/;
const LOGIN_RE = /^Welcome to EverQuest!$/;
const LOC_RE = /^Your Location is (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)$/;

// /who output: "[55 Wizard] Soandso (Race)" or "[ANONYMOUS] Soandso"
// Require (Race) after the name to avoid false positives on other bracketed messages
const WHO_RE = /^\[(\d+) (\w[\w ]*?)\] (\w+) \(/;
const WHO_ANON_RE = /^\[ANONYMOUS\] (\w+)/;

// Pet melee: "Soandso`s pet hits Mob for X damage" (EQ uses backtick, not apostrophe)
const PET_MELEE_RE = new RegExp(
  `^(.+?)[\`']s pet (${MELEE_VERBS_3P}) (.+?) for (\\d+) points? of damage\\.$`
);
const PET_KICK_RE = new RegExp(
  `^(.+?)[\`']s warder (${MELEE_VERBS_3P}) (.+?) for (\\d+) points? of damage\\.$`
);

// Discipline messages
const DISC_PATTERNS: Array<{ re: RegExp; cls: string }> = [
  { re: /^(\w+) assumes an aggressive posture\.$/, cls: 'Warrior' },
  { re: /^(\w+) assumes a defensive posture\.$/, cls: 'Warrior' },
  { re: /^(\w+) enters a berserker frenzy!$/, cls: 'Warrior' },
  { re: /^(\w+) is surrounded by an aura of benevolence\.$/, cls: 'Paladin' },
  { re: /^(\w+) calls upon the spirits of the dead\.$/, cls: 'Shadow Knight' },
  { re: /^(\w+) is surrounded by a vile aura\.$/, cls: 'Shadow Knight' },
  { re: /^(\w+) begins to move with blinding speed\.$/, cls: 'Monk' },
  { re: /^(\w+) falls to the ground\.$/, cls: '_feign' },
  { re: /^(.+?) has become ENRAGED\.$/, cls: '_npc' },
];

// Buff landing messages that identify the CASTER's class
// source = the entity whose buff landed, skill = inferred class
const BUFF_PATTERNS: Array<{ re: RegExp; cls: string; sourceGroup: number }> = [
  // Druid nature buffs
  { re: /^(.+?)'s skin turns to (?:wood|bark|rock|steel|diamond|nature)\.$/, cls: 'Druid', sourceGroup: 1 },
  { re: /^(.+?) feels the spirit of the wolf\.$/, cls: '_sow', sourceGroup: 1 },
  // Shaman slows — target staggers
  { re: /^(.+?) has been slowed\.$/, cls: 'Shaman', sourceGroup: 1 },
  // Enchanter haste/buffs
  { re: /^(.+?) feels much faster\.$/, cls: '_haste', sourceGroup: 1 },
  // Enchanter charm
  { re: /^(.+?) has been charmed\.$/, cls: 'Enchanter', sourceGroup: 1 },
  // Enchanter mesmerize
  { re: /^(.+?) has been mesmerized\.$/, cls: 'Enchanter', sourceGroup: 1 },
  // Cleric/healer big heals
  { re: /^(.+?) feels the touch of the divine\.$/, cls: 'Cleric', sourceGroup: 1 },
  // Note: the old (.+?) staggers\.$ pattern was removed here because it
  // conflicts with spell landing message detection. "X staggers." is the
  // cast_on_other message for Exile Undead, Banish Undead, and other spells.
  // Landing message matching is now handled via the spells_us.txt suffix map.
];

export function parseTimestamp(str: string): number {
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.getTime();
  const parts = str.match(/(\w+) (\w+) (\d+) (\d+):(\d+):(\d+) (\d+)/);
  if (!parts) return Date.now();
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  return new Date(
    parseInt(parts[7]),
    months[parts[2]] ?? 0,
    parseInt(parts[3]),
    parseInt(parts[4]),
    parseInt(parts[5]),
    parseInt(parts[6])
  ).getTime();
}

export function parseLine(line: string): CombatEvent | null {
  const tsMatch = TIMESTAMP_RE.exec(line);
  if (!tsMatch) return null;

  const timestamp = parseTimestamp(tsMatch[1]);
  const msg = tsMatch[2];
  let m: RegExpExecArray | null;

  // Melee damage
  m = YOU_MELEE_RE.exec(msg);
  if (m) return { timestamp, type: 'melee_damage', source: 'You', target: m[2], amount: parseInt(m[3]), skill: m[1] };

  // Pet melee (check before general OTHER_MELEE to catch "X`s pet hits")
  m = PET_MELEE_RE.exec(msg);
  if (m) return { timestamp, type: 'pet_melee', source: m[1], target: m[3], amount: parseInt(m[4]), skill: VERB_3P_TO_1P[m[2]] || m[2] };

  m = PET_KICK_RE.exec(msg);
  if (m) return { timestamp, type: 'pet_melee', source: m[1], target: m[3], amount: parseInt(m[4]), skill: VERB_3P_TO_1P[m[2]] || m[2] };

  m = OTHER_MELEE_RE.exec(msg);
  if (m) return { timestamp, type: 'melee_damage', source: m[1], target: m[3], amount: parseInt(m[4]), skill: VERB_3P_TO_1P[m[2]] || m[2] };

  // Non-melee (spell) damage — no source
  m = NONMELEE_RE.exec(msg);
  if (m) return { timestamp, type: 'spell_damage', source: '', target: m[1], amount: parseInt(m[2]), skill: 'non-melee' };

  // Misses
  m = YOU_MISS_RE.exec(msg);
  if (m) return { timestamp, type: 'miss', source: 'You', target: m[2], amount: 0, skill: m[1] };

  m = OTHER_MISS_RE.exec(msg);
  if (m) return { timestamp, type: 'miss', source: m[1], target: m[2], amount: 0, skill: 'attack' };

  // Deaths
  m = YOU_SLAIN_RE.exec(msg);
  if (m) return { timestamp, type: 'death', source: 'You', target: m[1], amount: 0, skill: '' };

  m = YOU_SLAIN_BY_RE.exec(msg);
  if (m) return { timestamp, type: 'death', source: m[1], target: 'You', amount: 0, skill: '' };

  m = SLAIN_BY_RE.exec(msg);
  if (m) return { timestamp, type: 'death', source: m[2], target: m[1], amount: 0, skill: '' };

  // Healing
  m = HEAL_RECEIVED_RE.exec(msg);
  if (m) return { timestamp, type: 'heal', source: m[1], target: 'You', amount: parseInt(m[2]), skill: 'heal' };

  m = HEAL_DONE_RE.exec(msg);
  if (m) return { timestamp, type: 'heal', source: 'You', target: m[1], amount: parseInt(m[2]), skill: 'heal' };

  // DoT ticks (your spells — known source and spell name)
  m = DOT_YOUR_RE.exec(msg);
  if (m) return { timestamp, type: 'dot_tick', source: 'You', target: m[1], amount: parseInt(m[2]), skill: m[3] };

  // Incoming DoT (damage taken by player)
  m = DOT_INCOMING_RE.exec(msg);
  if (m) return { timestamp, type: 'dot_tick', source: '', target: 'You', amount: parseInt(m[1]), skill: m[2] };

  // YOUR spell cast (with spell name)
  m = CAST_RE.exec(msg);
  if (m) return { timestamp, type: 'cast_start', source: 'You', target: '', amount: 0, skill: m[1] };

  // OTHER entity begins to cast (no spell name)
  m = OTHER_CAST_RE.exec(msg);
  if (m) return { timestamp, type: 'other_cast_start', source: m[1], target: '', amount: 0, skill: '' };

  // Cast interrupts
  m = YOUR_INTERRUPT_RE.exec(msg);
  if (m) return { timestamp, type: 'cast_interrupted', source: 'You', target: '', amount: 0, skill: '' };

  m = OTHER_INTERRUPT_RE.exec(msg);
  if (m) return { timestamp, type: 'cast_interrupted', source: m[1], target: '', amount: 0, skill: '' };

  // Fizzles
  m = YOUR_FIZZLE_RE.exec(msg);
  if (m) return { timestamp, type: 'cast_fizzle', source: 'You', target: '', amount: 0, skill: '' };

  m = OTHER_FIZZLE_RE.exec(msg);
  if (m) return { timestamp, type: 'cast_fizzle', source: m[1], target: '', amount: 0, skill: '' };

  // Full resist — spell landed but did not take effect
  m = SPELL_NO_HOLD_RE.exec(msg);
  if (m) return { timestamp, type: 'cast_resist', source: 'You', target: '', amount: 0, skill: '' };

  // Concentration recovery — interrupt was recovered, cast continues
  m = SPELL_RECOVERED_RE.exec(msg);
  if (m) return { timestamp, type: 'cast_recovered', source: 'You', target: '', amount: 0, skill: '' };

  // Charm break
  m = CHARM_BREAK_RE.exec(msg);
  if (m) return { timestamp, type: 'charm_break', source: 'You', target: '', amount: 0, skill: '' };

  // Group membership
  m = YOU_GROUP_JOIN_RE.exec(msg);
  if (m) return { timestamp, type: 'group_join', source: 'You', target: '', amount: 0, skill: '' };

  m = YOU_GROUP_LEAVE_RE.exec(msg);
  if (m) return { timestamp, type: 'group_leave', source: 'You', target: '', amount: 0, skill: '' };

  m = GROUP_JOIN_RE.exec(msg);
  if (m) return { timestamp, type: 'group_join', source: m[1], target: '', amount: 0, skill: '' };

  m = GROUP_LEAVE_RE.exec(msg);
  if (m) return { timestamp, type: 'group_leave', source: m[1], target: '', amount: 0, skill: '' };

  m = GROUP_CHAT_RE.exec(msg);
  if (m) return { timestamp, type: 'group_chat', source: m[1], target: '', amount: 0, skill: '' };

  // Login
  if (LOGIN_RE.test(msg)) return { timestamp, type: 'login', source: 'You', target: '', amount: 0, skill: '' };

  // Player location (/loc)
  m = LOC_RE.exec(msg);
  if (m) return {
    timestamp, type: 'player_location', source: 'You', target: '', amount: 0, skill: '',
    location: { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) },
  };

  // Zone change
  m = ZONE_RE.exec(msg);
  if (m) return { timestamp, type: 'zone_change', source: 'You', target: m[1], amount: 0, skill: '' };

  // /who zone summary — "There are 33 players in The Plane of Hate."
  m = WHO_ZONE_RE.exec(msg);
  if (m && m[1] !== 'EverQuest') {
    return { timestamp, type: 'zone_change', source: 'who', target: m[1], amount: 0, skill: '' };
  }

  // /who results — "[55 Wizard] Soandso (High Elf) <Guild>"
  m = WHO_RE.exec(msg);
  if (m) {
    return {
      timestamp, type: 'who_result',
      source: m[3], target: '', amount: parseInt(m[1]),
      skill: m[2].trim(),
    };
  }
  m = WHO_ANON_RE.exec(msg);
  if (m) return { timestamp, type: 'who_result', source: m[1], target: '', amount: 0, skill: 'ANONYMOUS' };

  // Discipline messages
  for (const dp of DISC_PATTERNS) {
    m = dp.re.exec(msg);
    if (m) return { timestamp, type: 'discipline', source: m[1], target: '', amount: 0, skill: dp.cls };
  }

  // Buff landing messages
  for (const bp of BUFF_PATTERNS) {
    m = bp.re.exec(msg);
    if (m) return { timestamp, type: 'buff_land', source: '', target: m[bp.sourceGroup], amount: 0, skill: bp.cls };
  }

  return null;
}

/**
 * Try to match a log message as a spell landing message.
 * Landing messages have the form: "TARGET_NAMEsuffix" where suffix comes from
 * spells_us.txt cast_on_other field (e.g. "'s skin freezes." or " staggers.").
 *
 * The suffixes array should be sorted longest-first for greedy matching.
 */
export function tryMatchLanding(
  msg: string,
  timestamp: number,
  landingSuffixes: string[],
): CombatEvent | null {
  const msgLower = msg.toLowerCase();
  for (const suffix of landingSuffixes) {
    if (msgLower.endsWith(suffix)) {
      // Extract target name (everything before the suffix)
      const targetEndIdx = msg.length - suffix.length;
      if (targetEndIdx <= 0) continue;
      const target = msg.substring(0, targetEndIdx);
      // Sanity: target should look like a name (at least 2 chars)
      if (target.length < 2) continue;

      return {
        timestamp,
        type: 'spell_land',
        source: '',
        target,
        amount: 0,
        skill: suffix, // the raw suffix — correlator uses this to look up spell info
      };
    }
  }
  return null;
}

/**
 * Try to match a log message as a charm spell landing.
 * Charm landing messages have the same form as spell landings but come from
 * non-damage charm spells (e.g. "a gnoll blinks.", "a gnoll has been entranced.").
 */
export function tryMatchCharmLanding(
  msg: string,
  timestamp: number,
  charmSuffixes: readonly string[],
): CombatEvent | null {
  const msgLower = msg.toLowerCase();
  for (const suffix of charmSuffixes) {
    if (msgLower.endsWith(suffix)) {
      const targetEndIdx = msg.length - suffix.length;
      if (targetEndIdx <= 0) continue;
      const target = msg.substring(0, targetEndIdx);
      if (target.length < 2) continue;

      return {
        timestamp,
        type: 'charm_land',
        source: '',
        target,
        amount: 0,
        skill: suffix,
      };
    }
  }
  return null;
}

export function extractCharacterName(filename: string): string {
  const m = filename.match(/eqlog_(.+?)_/);
  return m ? m[1] : 'Unknown';
}
