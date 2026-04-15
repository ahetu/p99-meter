// ── Timing windows (milliseconds) ──
export const MAX_CAST_WINDOW_MS = 12000;
export const MIN_CAST_TIME_MS = 500;
export const DS_WINDOW_MS = 1000;
export const PROC_WINDOW_MS = 800;
export const DOT_TICK_INTERVAL_MS = 6000;
export const DOT_TICK_TOLERANCE_MS = 1500;
export const COMBAT_TIMEOUT_MS = 6000;
export const FIGHT_GAP_MS = 12000;
export const SESSION_GAP_MS = 15 * 60 * 1000; // 15 minutes — gap longer than this resets the session
export const LANDING_EXPIRY_MS = 3000;
export const LANDING_MATCH_WINDOW_MS = 1500;

// ── Cast timing tolerances ──
export const CAST_EARLY_TOLERANCE_MS = 1500;
export const CAST_LATE_TOLERANCE_MS = 5000;

// ── Damage thresholds ──
export const DS_MAX_DAMAGE = 72;
export const PROC_MAX_DAMAGE = 150;

// ── Damage validation ──
export const DMG_TOLERANCE_TIGHT = 0.15;  // ±15% — used for scoring bonus, not hard filter
export const DMG_TOLERANCE_WIDE = 0.60;   // 60% cap — accounts for focus item bonuses on P99
export const DMG_TOLERANCE_FLOOR = 0.50;  // reject if actual < 50% of expected (partial resists can halve)

// ── Array size caps (prevent unbounded growth) ──
export const MAX_PENDING_CASTS = 100;
export const MAX_RECENT_MELEE_HITS = 200;
export const MAX_DOT_TRACKERS = 50;
export const MAX_PENDING_LANDINGS = 50;

// ── Scoring baselines for spell attribution ──
export const SCORE_PLAYER_LANDING = 300;
export const SCORE_PLAYER_CAST_DB = 200;
export const SCORE_GROUP_LANDING = 200;
export const SCORE_OTHER_LANDING = 100;
export const SCORE_PLAYER_CAST_NOBD = 100;
export const SCORE_GROUP_CAST = 80;
export const SCORE_GROUP_LANDING_NOCAST = 80;
export const SCORE_ZONE_LANDING = 150;
export const SCORE_ZONE_CAST = 60;
export const SCORE_ZONE_LANDING_NOCAST = 60;
export const SCORE_OTHER_LANDING_NOCAST = 40;
export const SCORE_UNKNOWN_MOB_HIT = 20;
export const SCORE_MOB_HIT_PLAYER = 50;

// ── Confidence thresholds for attribution ──
export const CONFIDENCE_HIGH_THRESHOLD = 60;
export const CONFIDENCE_MEDIUM_THRESHOLD = 30;

// ── Spell damage labels (used for logic branching — NOT display strings) ──
export const LABEL_NONMELEE = 'Non-melee';
export const LABEL_DAMAGE_SHIELD = 'Damage Shield';
export const LABEL_DOT = 'DoT';
export const LABEL_PROC = 'Proc';
export const LABEL_OTHERS_SPELLS = 'Others (Spells)';

// ── Charm spell tracking ──
// Classes that can charm NPCs to fight for them. The charmed NPC does melee
// damage to other NPCs, which we attribute to the charm owner.
export const CHARM_SPELL_NAMES = new Set([
  // Enchanter
  'charm', 'beguile', 'cajoling whispers', 'allure', 'entrance',
  'fascination', 'overwhelming splendor', 'dictate',
  // Necromancer (undead charm)
  'dominate undead', 'beguile undead', 'cajole undead', 'enslave death',
  // Druid (animal/plant charm)
  'charm animals', 'beguile animals', 'beguile plants', 'allure of the wild',
  'befriend animal', 'call of karana', "tunare's request",
  // Bard
  "solon's song of the sirens", "solon`s song of the sirens",
  "solon's bewitching bravura", "solon`s bewitching bravura",
  // Shaman (shared Charm Animals — already listed under Druid)
]);

// Charm landing suffixes → used to detect WHICH mob was charmed when a charm
// spell lands. These come from the cast_on_other field in spells_us.txt.
// Sorted longest-first for greedy matching.
export const CHARM_LANDING_SUFFIXES: readonly string[] = [
  ' is adorned in an aura of radiant grace.',  // Enchanter: Overwhelming Splendor
  "'s eyes glaze over.",                        // Bard: Solon's songs
  ' has been fascinated.',                      // Enchanter: Fascination
  ' has been entranced.',                       // Enchanter: Entrance
  ' blinks.',                                   // Druid/Shaman: animal/plant charm
  ' moans.',                                    // Necromancer: undead charm
];

export const CHARM_MAX_DURATION_MS = 120_000;  // charms rarely last > 2 minutes on P99
export const CHARM_BREAK_INFER_MS = 5000;      // if charmed mob hits a player, charm broke

// ── Regex shared between logParser and logWatcher ──
export const TIMESTAMP_RE = /^\[(\w+ \w+ \d+ \d+:\d+:\d+ \d+)\] (.+)$/;

// ── NPC detection ──
// In EQ, NPC names start with a lowercase letter or article ("a gnoll", "an orc",
// "the Fright"). Player names always start with an uppercase letter and never
// contain spaces in P99. Named NPCs like "Guard Blayle" start uppercase but
// contain a space.
// Well-known P99 named NPCs with single-word uppercase names.
// These bypass the heuristic and are always treated as NPCs.
const KNOWN_NAMED_NPCS = new Set([
  // Classic raid bosses
  'Nagafen', 'Vox', 'Phinigel', 'Innoruuk', 'Cazic', 'Trakanon',
  'Gorenaire', 'Talendor', 'Severilous', 'Faydedar', 'Venril',
  // Kunark bosses
  'Phara', 'Silverwing', 'Xygoz',
  // Velious bosses
  'Yelinak', 'Klandicar', 'Zlandicar', 'Sontalak', 'Dozekar',
  'Vulak', 'Statue', 'Tunare', 'Rallos', 'Tormax',
  // Named NPCs commonly encountered
  'Fippy', 'Dvinn', 'Lockjaw', 'Stonebrunt', 'Quillmane',
  'Hadden', 'Solusek', 'Miragul', 'Kerafyrm',
]);

export function isLikelyNPC(name: string): boolean {
  if (!name) return true;
  const first = name.charAt(0);
  if (first >= 'a' && first <= 'z') return true;
  if (name.includes(' ')) return true;
  if (KNOWN_NAMED_NPCS.has(name)) return true;
  return false;
}

// ── Source/target normalization ──
// EQ logs use 'You' for the player — normalize to actual character name.
export function normalizeSource(raw: string, playerName: string): string {
  return raw === 'You' ? playerName : raw;
}

export function normalizeTarget(raw: string, playerName: string): string {
  return raw === 'You' ? playerName : raw;
}
