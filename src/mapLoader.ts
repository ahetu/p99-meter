import * as fs from 'fs';
import * as path from 'path';
import { parseMapData, ZoneMap } from './mapParser';

/**
 * Loads all Brewall map files for a zone by short name.
 * Reads <zone>.txt (geometry) and <zone>_1.txt (labels) — _2 files are
 * coordinate grids we don't need.
 *
 * Checks the maps/ folder next to the executable (packaged) or in the
 * project root (dev).
 */
export function loadZoneMap(zone: string, appRoot: string): ZoneMap | null {
  const mapsDir = resolveMapDir(appRoot);
  if (!mapsDir) return null;

  const lowerZone = zone.toLowerCase();
  const baseFile = path.join(mapsDir, `${lowerZone}.txt`);
  const labelsFile = path.join(mapsDir, `${lowerZone}_1.txt`);

  let combined = '';

  if (fs.existsSync(baseFile)) {
    combined += fs.readFileSync(baseFile, 'utf-8') + '\n';
  }
  if (fs.existsSync(labelsFile)) {
    combined += fs.readFileSync(labelsFile, 'utf-8') + '\n';
  }

  if (!combined.trim()) return null;

  return parseMapData(combined);
}

/** Returns the list of available zone short names. */
export function listAvailableZones(appRoot: string): string[] {
  const mapsDir = resolveMapDir(appRoot);
  if (!mapsDir) return [];
  try {
    return fs.readdirSync(mapsDir)
      .filter(f => f.endsWith('.txt') && !f.includes('_'))
      .map(f => f.replace('.txt', ''));
  } catch {
    return [];
  }
}

function resolveMapDir(appRoot: string): string | null {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'maps'),                  // dev: project root (.webpack/main/ → project)
    path.join(appRoot, 'maps'),                                    // packaged: next to exe
    path.join(path.dirname(appRoot), 'maps'),
    path.resolve(__dirname, '..', 'maps'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

/**
 * Map from "You have entered <ZoneName>." display name to zone short name.
 * This covers P99 Classic/Kunark/Velious zones.
 */
const ZONE_NAME_MAP: Record<string, string> = {
  'North Freeport': 'freportn',
  'East Freeport': 'freporte',
  'West Freeport': 'freportw',
  'Greater Faydark': 'gfaydark',
  'Lesser Faydark': 'lfaydark',
  'Northern Plains of Karana': 'northkarana',
  'Southern Plains of Karana': 'southkarana',
  'Eastern Plains of Karana': 'eastkarana',
  'Western Plains of Karana': 'qey2hh1',
  'Surefall Glade': 'qrg',
  'Qeynos Hills': 'qeytoqrg',
  'South Qeynos': 'qeynos',
  'North Qeynos': 'qeynos2',
  'The Qeynos Aqueduct System': 'qcat',
  'Befallen': 'befallen',
  'Blackburrow': 'blackburrow',
  'Butcherblock Mountains': 'butcher',
  'Steamfont Mountains': 'steamfont',
  'Ak\'Anon': 'akanon',
  'AkAnon': 'akanon',
  'Crushbone': 'crushbone',
  'Castle Mistmoore': 'mistmoore',
  'Unrest': 'unrest',
  'Dagnor\'s Cauldron': 'cauldron',
  'Dagnors Cauldron': 'cauldron',
  'Estate of Unrest': 'unrest',
  'Kithicor Forest': 'kithicor',
  'Highpass Hold': 'highpass',
  'High Keep': 'highkeep',
  'East Commonlands': 'ecommons',
  'West Commonlands': 'commons',
  'Nektulos Forest': 'nektulos',
  'Lavastorm Mountains': 'lavastorm',
  'Najena': 'najena',
  'Solusek\'s Eye': 'soldunga',
  'Soluseks Eye': 'soldunga',
  'Nagafen\'s Lair': 'soldungb',
  'Nagafens Lair': 'soldungb',
  'Temple of Solusek Ro': 'soltemple',
  'Neriak Foreign Quarter': 'neriaka',
  'Neriak Commons': 'neriakb',
  'Neriak Third Gate': 'neriakc',
  'Innothule Swamp': 'innothule',
  'The Feerrott': 'feerrott',
  'Cazic-Thule': 'cazicthule',
  'Oggok': 'oggok',
  'Grobb': 'grobb',
  'Upper Guk': 'guktop',
  'Lower Guk': 'gukbottom',
  'Misty Thicket': 'misty',
  'Rivervale': 'rivervale',
  'Runnyeye Citadel': 'runnyeye',
  'Paineel': 'paineel',
  'The Hole': 'hole',
  'Erudin': 'erudnext',
  'Erudin Palace': 'erudnint',
  'Erud\'s Crossing': 'erudsxing',
  'Eruds Crossing': 'erudsxing',
  'Toxxulia Forest': 'tox',
  'Stonebrunt Mountains': 'stonebrunt',
  'The Warrens': 'warrens',
  'Kerra Isle': 'kerraridge',
  'Halas': 'halas',
  'Everfrost Peaks': 'everfrost',
  'Permafrost Keep': 'permafrost',
  'North Desert of Ro': 'nro',
  'North Ro': 'nro',
  'South Desert of Ro': 'sro',
  'South Ro': 'sro',
  'Oasis of Marr': 'oasis',
  'Ocean of Tears': 'oot',
  'Kedge Keep': 'kedge',
  'Arena': 'arena',
  'Plane of Fear': 'fearplane',
  'Plane of Hate': 'hateplane',
  'Plane of Sky': 'airplane',
  'Lair of the Splitpaw': 'paw',
  'Rathe Mountains': 'rathemtn',
  'Mountains of Rathe': 'rathemtn',
  'Lake Rathetear': 'lakerathe',
  'Gorge of King Xorbb': 'beholder',
  'Felwithe': 'felwithea',
  'Northern Felwithe': 'felwithea',
  'Southern Felwithe': 'felwitheb',
  'Kaladim': 'kaladima',
  'North Kaladim': 'kaladimb',
  'South Kaladim': 'kaladima',
  'Cabilis East': 'cabeast',
  'Cabilis West': 'cabwest',
  'East Cabilis': 'cabeast',
  'West Cabilis': 'cabwest',

  // Kunark
  'The Burning Wood': 'burningwood',
  'Howling Stones': 'charasis',
  'Chardok': 'chardok',
  'City of Mist': 'citymist',
  'Dreadlands': 'dreadlands',
  'Mines of Droga': 'droga',
  'Emerald Jungle': 'emeraldjungle',
  'Field of Bone': 'fieldofbone',
  'Firiona Vie': 'firiona',
  'Frontier Mountains': 'frontiermtns',
  'Kaesora': 'kaesora',
  'Karnor\'s Castle': 'karnor',
  'Karnors Castle': 'karnor',
  'Lake of Ill Omen': 'lakeofillomen',
  'Mines of Nurga': 'nurga',
  'The Overthere': 'overthere',
  'Old Sebilis': 'sebilis',
  'Skyfire Mountains': 'skyfire',
  'Swamp of No Hope': 'swampofnohope',
  'Timorous Deep': 'timorous',
  'Trakanon\'s Teeth': 'trakanon',
  'Trakanons Teeth': 'trakanon',
  'Veeshan\'s Peak': 'veeshan',
  'Veeshans Peak': 'veeshan',
  'The Wakening Land': 'wakening',
  'Warsliks Wood': 'warslikswood',
  'Dalnir': 'dalnir',

  // Velious
  'Cobalt Scar': 'cobaltscar',
  'Crystal Caverns': 'crystal',
  'Eastern Wastes': 'eastwastes',
  'Tower of Frozen Shadow': 'frozenshadow',
  'Great Divide': 'greatdivide',
  'Plane of Growth': 'growthplane',
  'Iceclad Ocean': 'iceclad',
  'Kael Drakkel': 'kael',
  'Plane of Mischief': 'mischiefplane',
  'Dragon Necropolis': 'necropolis',
  'Siren\'s Grotto': 'sirens',
  'Sirens Grotto': 'sirens',
  'Skyshrine': 'skyshrine',
  'Sleeper\'s Tomb': 'sleeper',
  'Sleepers Tomb': 'sleeper',
  'Temple of Veeshan': 'templeveeshan',
  'Thurgadin': 'thurgadina',
  'Icewell Keep': 'thurgadinb',
  'Velketor\'s Labyrinth': 'velketor',
  'Velketors Labyrinth': 'velketor',
  'Western Wastes': 'westwastes',
};

let cachedZoneFiles: string[] | null = null;

/** Pre-populate the available zone file cache (call once at startup). */
export function initZoneFileCache(appRoot: string) {
  cachedZoneFiles = listAvailableZones(appRoot);
}

/** Resolve a display zone name (from "You have entered X." or /who summary) to a map file short name. */
export function resolveZoneShortName(displayName: string): string {
  // EQ log files use backticks instead of apostrophes in zone names
  const canonical = displayName.replace(/`/g, "'");
  const normalized = canonical.replace(/^The /i, '');

  // Direct lookup (try both original and stripped-The forms)
  if (ZONE_NAME_MAP[canonical]) return ZONE_NAME_MAP[canonical];
  if (ZONE_NAME_MAP[normalized]) return ZONE_NAME_MAP[normalized];

  // Try case-insensitive
  const lower = normalized.toLowerCase();
  for (const [key, val] of Object.entries(ZONE_NAME_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }

  // Fallback: strip to alphanumeric and try fuzzy match against map files
  const stripped = lower.replace(/[^a-z0-9]/g, '');
  const depluralized = stripped.endsWith('s') ? stripped.slice(0, -1) : stripped;

  if (cachedZoneFiles) {
    if (cachedZoneFiles.includes(stripped)) return stripped;
    if (depluralized !== stripped && cachedZoneFiles.includes(depluralized)) return depluralized;

    // Prefix/overlap match: handles plural variants ("warslikswoods" → "warslikswood"),
    // appended words ("kithicorwoods" → "kithicor"), etc.
    let bestMatch: string | null = null;
    let bestLen = 0;
    for (const zone of cachedZoneFiles) {
      if (stripped.startsWith(zone) || zone.startsWith(stripped)) {
        const overlap = Math.min(stripped.length, zone.length);
        const longer = Math.max(stripped.length, zone.length);
        if (overlap / longer >= 0.6 && zone.length > bestLen) {
          bestMatch = zone;
          bestLen = zone.length;
        }
      }
    }
    if (bestMatch) return bestMatch;
  }

  return stripped;
}
