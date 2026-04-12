/**
 * Downloads Brewall map files for P99-era zones (Classic, Kunark, Velious)
 * from the RedGuides/brewall-maps GitHub repo.
 *
 * Usage: node scripts/download-maps.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const MAPS_DIR = path.resolve(__dirname, '..', 'maps');

// P99 zone short names: Classic, Kunark, Velious
const P99_ZONES = [
  // ── Classic ──
  'airplane','akanon','arena','befallen','blackburrow','butcher','cabeast','cabwest',
  'cauldron','cazicthule','commons','crushbone','dalnir','ecommons','erudnext','erudnint',
  'erudsxing','everfrost','fearplane','feerrott','felwithea','felwitheb','freporte',
  'freportn','freportw','gfaydark','grobb','gukbottom','guktop','halas','hateplane',
  'highkeep','highpass','hole','innothule','kaladima','kaladimb','kedge','kerraridge',
  'kithicor','lavastorm','lfaydark','mistmoore','misty','najena','nektulos','neriaka',
  'neriakb','neriakc','northkarana','nro','oasis','oggok','oot','paineel','paw',
  'permafrost','qcat','qey2hh1','qeynos','qeynos2','qeytoqrg','qrg','rathemtn',
  'rivervale','runnyeye','soldunga','soldungb','soltemple','southkarana','sro',
  'steamfont','stonebrunt','swampofnohope','tox','unrest','warrens','westwastes',

  // ── Kunark ──
  'burningwood','cabilisteqb','cabilisteqa','charasis','chardok','citymist',
  'dreadlands','droga','emeraldjungle','fieldofbone','firiona','frontiermtns',
  'kaesora','karnor','lakeofillomen','nurga','overthere','sebilis','skyfire',
  'swampofnohope','timorous','trakanon','veeshan','wakening','warslikswood',

  // ── Velious ──
  'cobaltscar','crystal','eastwastes','frozenshadow','greatdivide','growthplane',
  'iceclad','kael','mischiefplane','necropolis','sirens','skyshrine','sleeper',
  'templeveeshan','thurgadina','thurgadinb','velketor','westwastes',
];

// Deduplicate
const zones = [...new Set(P99_ZONES)];

function fetch(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'p99-meter-map-downloader' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode === 404) { resolve(null); return; }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${u}`)); return; }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

async function downloadZone(zone) {
  const baseUrl = `https://raw.githubusercontent.com/RedGuides/brewall-maps/main/Brewall's%20Maps`;
  const suffixes = ['', '_1', '_2'];
  let got = 0;
  for (const suffix of suffixes) {
    const filename = `${zone}${suffix}.txt`;
    const url = `${baseUrl}/${filename}`;
    try {
      const data = await fetch(url);
      if (data && data.trim().length > 0) {
        fs.writeFileSync(path.join(MAPS_DIR, filename), data);
        got++;
      }
    } catch (err) {
      // skip silently
    }
  }
  return got;
}

async function main() {
  fs.mkdirSync(MAPS_DIR, { recursive: true });
  console.log(`Downloading maps for ${zones.length} P99 zones...`);
  let total = 0;
  let zoneCount = 0;

  // Download in small batches to avoid hammering the server
  const BATCH = 5;
  for (let i = 0; i < zones.length; i += BATCH) {
    const batch = zones.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(downloadZone));
    for (let j = 0; j < batch.length; j++) {
      if (results[j] > 0) {
        zoneCount++;
        total += results[j];
        console.log(`  ${batch[j]}: ${results[j]} file(s)`);
      } else {
        console.log(`  ${batch[j]}: NOT FOUND`);
      }
    }
  }
  console.log(`\nDone! Downloaded ${total} files for ${zoneCount} zones into maps/`);
}

main().catch(console.error);
