export interface MapLine {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  r: number; g: number; b: number;
}

export type LabelCategory = 'zone' | 'landmark' | 'vendor' | 'hunter' | 'ground' | 'named' | 'noise' | 'nonp99';

export interface MapLabel {
  x: number; y: number; z: number;
  r: number; g: number; b: number;
  size: 'small' | 'large';
  text: string;
  category: LabelCategory;
}

export interface MapBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface FloorInfo {
  zMin: number;
  zMax: number;
  zCenter: number;
}

export type ZMode = 'flat' | 'floors' | 'window';

export interface ZoneMap {
  lines: MapLine[];
  labels: MapLabel[];
  bounds: MapBounds;
  zMode: ZMode;
  floors: FloorInfo[];
}

const NON_P99_RE = /Plane_of_Knowledge|Click_Book|Corathus|Feerott_the_Dream|the_Dream_\(click\)|LDoN|Wayfarer|Magus_.*Port|\(Mission[,)]|\(Parcels\)|DKU[:\d]|\(Melee_Augs\)|\(Kill_Quests?\)|Nights?_of_the_Dead|\(Reborn\)|Fabled_|_the_Fabled_|\(Tribute|\(Task_Master|\(Mercenary|\(Augmentation|Adventure_Merchant|Adventure_Point|Group_Adventures/i;
const NOISE_RE = /^\.$|^[0-9]$|^https?:|^Revised_Map:|^Original_Map:|^Return_of_the|eqmaps\.info|roteguild\.org/i;
const ZONE_RE = /^to_/i;
const HUNTER_RE = /\(Hunter|\(Roam/i;
const VENDOR_RE = /\((Merchant|Spells|Smithing|Tailor|Weapons|Armor|Bar|Baking|Fishing|Fletching|Jewelry|Gems|Pottery|Brewing|Tinkering|Research|Alchemy|Poison|Soulbinder|Banker|GM_)/i;
const GROUND_SPAWN_RE = /^GS[_:]|^GS$/i;
const LANDMARK_RE = /^(Succor|Druid_Ring|Wizard_Spires|Minor_Spires|Fake_Wall|Safe_Hall|Safe_Spot|Safe_Room|TRAP|Ladder|Bridge|Pit|Waterfall|Toll_Booth|Up|Down|Bedroom|Spider_Room|Camp_?Fire|Undead_Tower|Submerged_Hut|Swamp_Boat|Kobolds?|Kolbolds?)$|\b(Camp|Room|Entrance|Exit|Tunnel|Stairs|Door|Gate|Tower|Arena|Hut|Village|Ring|Spires)\b/i;

function classifyLabel(raw: string): LabelCategory {
  if (NOISE_RE.test(raw)) return 'noise';
  if (NON_P99_RE.test(raw)) return 'nonp99';
  if (ZONE_RE.test(raw)) return 'zone';
  if (LANDMARK_RE.test(raw)) return 'landmark';
  if (GROUND_SPAWN_RE.test(raw)) return 'ground';
  if (HUNTER_RE.test(raw)) return 'hunter';
  if (VENDOR_RE.test(raw)) return 'vendor';
  return 'named';
}

/**
 * Parse Brewall-format map file content (.txt).
 * L lines: geometry segments — "L x1, y1, z1, x2, y2, z2, r, g, b"
 * P lines: POI labels       — "P x, y, z, r, g, b, size, label_text"
 */
export function parseMapData(text: string): ZoneMap {
  const lines: MapLine[] = [];
  const labels: MapLabel[] = [];
  const bounds: MapBounds = {
    minX: Infinity, maxX: -Infinity,
    minY: Infinity, maxY: -Infinity,
    minZ: Infinity, maxZ: -Infinity,
  };

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('L ')) {
      const parts = trimmed.substring(2).split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length < 9) continue;
      const ml: MapLine = {
        x1: parseFloat(parts[0]), y1: parseFloat(parts[1]), z1: parseFloat(parts[2]),
        x2: parseFloat(parts[3]), y2: parseFloat(parts[4]), z2: parseFloat(parts[5]),
        r: parseInt(parts[6], 10), g: parseInt(parts[7], 10), b: parseInt(parts[8], 10),
      };
      if (isNaN(ml.x1) || isNaN(ml.y1)) continue;
      lines.push(ml);

      bounds.minX = Math.min(bounds.minX, ml.x1, ml.x2);
      bounds.maxX = Math.max(bounds.maxX, ml.x1, ml.x2);
      bounds.minY = Math.min(bounds.minY, ml.y1, ml.y2);
      bounds.maxY = Math.max(bounds.maxY, ml.y1, ml.y2);
      bounds.minZ = Math.min(bounds.minZ, ml.z1, ml.z2);
      bounds.maxZ = Math.max(bounds.maxZ, ml.z1, ml.z2);
    } else if (trimmed.startsWith('P ')) {
      const parts = trimmed.substring(2).split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length < 8) continue;
      const rawLabel = parts.slice(7).join(',');
      const text = rawLabel.replace(/_/g, ' ');
      const category = classifyLabel(rawLabel);
      const isLarge = rawLabel.toLowerCase().startsWith('to_') || rawLabel.toLowerCase().startsWith('to ');
      labels.push({
        x: parseFloat(parts[0]), y: parseFloat(parts[1]), z: parseFloat(parts[2]),
        r: parseInt(parts[3], 10), g: parseInt(parts[4], 10), b: parseInt(parts[5], 10),
        size: isLarge ? 'large' : 'small',
        text,
        category,
      });
    }
  }

  if (!isFinite(bounds.minX)) {
    bounds.minX = bounds.maxX = bounds.minY = bounds.maxY = bounds.minZ = bounds.maxZ = 0;
  }

  const { zMode, floors } = detectFloors(lines, bounds);
  return { lines, labels, bounds, zMode, floors };
}

const FLOOR_BIN_SIZE = 5;
const FLOOR_GAP_THRESHOLD = 20;
const FLAT_Z_RANGE = 200;
const MIN_FLOOR_COUNT = 3;
const WINDOW_Z_XY_RATIO = 0.2;

function detectFloors(lines: MapLine[], bounds: MapBounds): { zMode: ZMode; floors: FloorInfo[] } {
  const zRange = bounds.maxZ - bounds.minZ;
  if (zRange < FLAT_Z_RANGE) return { zMode: 'flat', floors: [] };
  if (lines.length === 0) return { zMode: 'flat', floors: [] };

  // Build histogram of z-midpoints using fixed bins
  const binCount = Math.ceil(zRange / FLOOR_BIN_SIZE) + 1;
  const bins = new Uint32Array(binCount);
  for (const line of lines) {
    const zmid = (line.z1 + line.z2) / 2;
    const idx = Math.floor((zmid - bounds.minZ) / FLOOR_BIN_SIZE);
    if (idx >= 0 && idx < binCount) bins[idx]++;
  }

  // Find contiguous groups of non-empty bins separated by gaps
  const groups: { startBin: number; endBin: number }[] = [];
  let inGroup = false;
  let groupStart = 0;
  for (let i = 0; i < binCount; i++) {
    if (bins[i] > 0) {
      if (!inGroup) { inGroup = true; groupStart = i; }
    } else {
      if (inGroup) {
        groups.push({ startBin: groupStart, endBin: i - 1 });
        inGroup = false;
      }
    }
  }
  if (inGroup) groups.push({ startBin: groupStart, endBin: binCount - 1 });

  // Check gaps between consecutive groups
  const floors: FloorInfo[] = [];
  let largeGapCount = 0;
  for (let i = 0; i < groups.length; i++) {
    if (i > 0) {
      const gapBins = groups[i].startBin - groups[i - 1].endBin - 1;
      const gapUnits = gapBins * FLOOR_BIN_SIZE;
      if (gapUnits >= FLOOR_GAP_THRESHOLD) {
        largeGapCount++;
      } else {
        // Merge this group with the previous one
        const prev = floors[floors.length - 1];
        if (prev) {
          const g = groups[i];
          prev.zMax = bounds.minZ + (g.endBin + 1) * FLOOR_BIN_SIZE;
          prev.zCenter = (prev.zMin + prev.zMax) / 2;
          continue;
        }
      }
    }
    const g = groups[i];
    const zMin = bounds.minZ + g.startBin * FLOOR_BIN_SIZE;
    const zMax = bounds.minZ + (g.endBin + 1) * FLOOR_BIN_SIZE;
    floors.push({ zMin, zMax, zCenter: (zMin + zMax) / 2 });
  }

  if (largeGapCount >= MIN_FLOOR_COUNT - 1 && floors.length >= MIN_FLOOR_COUNT) {
    return { zMode: 'floors', floors };
  }

  // Use z-window mode for compact multi-level zones (dungeons) where geometry
  // overlaps vertically but has no clean floor gaps. The z/xy ratio distinguishes
  // these from outdoor zones with hilly terrain.
  const xySpan = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (xySpan > 0 && zRange / xySpan >= WINDOW_Z_XY_RATIO) {
    return { zMode: 'window', floors: [] };
  }

  return { zMode: 'flat', floors: [] };
}
