export interface MapLine {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  r: number; g: number; b: number;
}

export interface MapLabel {
  x: number; y: number; z: number;
  r: number; g: number; b: number;
  size: 'small' | 'large';
  text: string;
}

export interface MapBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface ZoneMap {
  lines: MapLine[];
  labels: MapLabel[];
  bounds: MapBounds;
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
      const isLarge = parts[7].toLowerCase().startsWith('to_') || parts[7].toLowerCase().startsWith('to ');
      labels.push({
        x: parseFloat(parts[0]), y: parseFloat(parts[1]), z: parseFloat(parts[2]),
        r: parseInt(parts[3], 10), g: parseInt(parts[4], 10), b: parseInt(parts[5], 10),
        size: isLarge ? 'large' : 'small',
        text: parts.slice(7).join(',').replace(/_/g, ' '),
      });
    }
  }

  if (!isFinite(bounds.minX)) {
    bounds.minX = bounds.maxX = bounds.minY = bounds.maxY = bounds.minZ = bounds.maxZ = 0;
  }

  return { lines, labels, bounds };
}
