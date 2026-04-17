// Logger must be imported first, before anything else
import { logInfo, logError, logWarn, logDebug, getLogFilePath, getDataDir } from './logger';

logInfo('=== p99-meter process starting ===');
logInfo('Process info', {
  execPath: process.execPath,
  argv: process.argv,
  cwd: process.cwd(),
  pid: process.pid,
  versions: { node: process.versions.node, electron: process.versions.electron, chrome: process.versions.chrome },
});
logInfo('Log file location', { logFile: getLogFilePath() });

// Global error handlers — set up before any other imports
process.on('uncaughtException', (err) => {
  logError('UNCAUGHT EXCEPTION', { message: err.message, stack: err.stack, name: err.name });
});
process.on('unhandledRejection', (reason) => {
  logError('UNHANDLED REJECTION', { reason: String(reason) });
});

// Now import everything else, wrapped in try/catch
let app: typeof import('electron').app;
let BrowserWindow: typeof import('electron').BrowserWindow;
let Tray: typeof import('electron').Tray;
let Menu: typeof import('electron').Menu;
let ipcMain: typeof import('electron').ipcMain;
let nativeImage: typeof import('electron').nativeImage;
let shell: typeof import('electron').shell;
let screen: typeof import('electron').screen;

try {
  const electron = require('electron');
  app = electron.app;
  BrowserWindow = electron.BrowserWindow;
  Tray = electron.Tray;
  Menu = electron.Menu;
  ipcMain = electron.ipcMain;
  nativeImage = electron.nativeImage;
  shell = electron.shell;
  screen = electron.screen;
  logInfo('Electron modules loaded');
} catch (err: any) {
  logError('FATAL: Failed to load electron modules', { message: err.message, stack: err.stack });
  process.exit(1);
}

let OverlayController: any;
let OVERLAY_WINDOW_OPTS: any;
try {
  const overlay = require('electron-overlay-window');
  OverlayController = overlay.OverlayController;
  OVERLAY_WINDOW_OPTS = overlay.OVERLAY_WINDOW_OPTS;
  logInfo('electron-overlay-window loaded', { keys: Object.keys(overlay) });
} catch (err: any) {
  logError('FATAL: Failed to load electron-overlay-window', { message: err.message, stack: err.stack });
  logError('Module search paths', { paths: (module as any).paths });
  process.exit(1);
}

import * as path from 'path';
import * as fs from 'fs';

let LogWatcher: typeof import('./logWatcher').LogWatcher;
let extractCharacterName: typeof import('./logParser').extractCharacterName;
let loadAllSpellData: typeof import('./spellDatabase').loadAllSpellData;
let loadZoneMap: typeof import('./mapLoader').loadZoneMap;
let resolveZoneShortName: typeof import('./mapLoader').resolveZoneShortName;
try {
  LogWatcher = require('./logWatcher').LogWatcher;
  extractCharacterName = require('./logParser').extractCharacterName;
  loadAllSpellData = require('./spellDatabase').loadAllSpellData;
  loadZoneMap = require('./mapLoader').loadZoneMap;
  resolveZoneShortName = require('./mapLoader').resolveZoneShortName;
  logInfo('Local modules loaded (logWatcher, logParser, spellDatabase, mapLoader)');
} catch (err: any) {
  logError('FATAL: Failed to load local modules', { message: err.message, stack: err.stack });
  process.exit(1);
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const TOOLTIP_WINDOW_WEBPACK_ENTRY: string;
declare const TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAP_WINDOW_WEBPACK_ENTRY: string;
declare const MAP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

try {
  if (require('electron-squirrel-startup')) {
    logInfo('Squirrel startup detected — quitting');
    app.quit();
  }
} catch {
  logDebug('electron-squirrel-startup not available (dev mode)');
}

// ── Single instance lock ──
// Prevent multiple meters from running simultaneously.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  logWarn('Another instance is already running — quitting this one');
  app.quit();
} else {
  app.on('second-instance', () => {
    logInfo('Second instance attempted — focusing existing window');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const APP_DIR = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : path.resolve(__dirname, '..', '..', '..', '..');
const EQ_DIR = app.isPackaged
  ? path.resolve(APP_DIR, '..')
  : APP_DIR;
const LOGS_DIR = path.join(EQ_DIR, 'Logs');

logInfo('Paths resolved', {
  isPackaged: app.isPackaged,
  EQ_DIR,
  LOGS_DIR,
  logFile: getLogFilePath(),
});

let mainWindow: import('electron').BrowserWindow | null = null;
let trackingWindow: import('electron').BrowserWindow | null = null;
let tray: import('electron').Tray | null = null;
let logWatcher: InstanceType<typeof LogWatcher> | null = null;
let currentLogStatus: { attached: boolean; character: string; logFile: string } | null = null;
let currentWatchedLogPath: string | null = null;
let lastEqBounds = { x: 0, y: 0, width: 1024, height: 768 };

// ── Layout persistence ──
const DEFAULT_OFFSET = { x: 20, y: 20 };
const DEFAULT_SIZE = { w: 320, h: 350 };
const DATA_DIR = getDataDir();
const LAYOUT_FILE = path.join(DATA_DIR, 'p99-meter-layout.json');
const CLASSDB_FILE = path.join(DATA_DIR, 'p99-meter-classdb.json');
logInfo('Persistence files', { DATA_DIR, LAYOUT_FILE, CLASSDB_FILE });

// Migrate config files from old EQ_DIR location if they exist there but not in DATA_DIR
for (const fname of ['p99-meter-layout.json', 'p99-meter-classdb.json']) {
  const oldPath = path.join(EQ_DIR, fname);
  const newPath = path.join(DATA_DIR, fname);
  try {
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.copyFileSync(oldPath, newPath);
      logInfo('Migrated config file', { from: oldPath, to: newPath });
    }
  } catch (err: any) {
    logWarn('Failed to migrate config file', { file: fname, error: err.message });
  }
}

let meterOffset = { ...DEFAULT_OFFSET };
let meterSize = { ...DEFAULT_SIZE };
let spellDb: Record<string, import('./spellDatabase').SpellInfo> = {};
let landingMap: Record<string, import('./spellDatabase').LandingSpellInfo[]> = {};
let landingSuffixes: string[] = [];
let tooltipWindow: import('electron').BrowserWindow | null = null;
let mapWindow: import('electron').BrowserWindow | null = null;
let mapVisible = false;
let currentMapZone = '';
let currentMapZoneDisplay = '';
let pendingZoneReload = false;
let mapSettings: { darkMode?: boolean; centerOnPlayer?: boolean; zoomCache?: Record<string, { zoom: number; panX: number; panY: number }> } = {};

const DEFAULT_MAP_SIZE = { w: 450, h: 450 };
const DEFAULT_MAP_OFFSET = { x: -470, y: 20 };
let mapOffset = { ...DEFAULT_MAP_OFFSET };
let mapSize = { ...DEFAULT_MAP_SIZE };

function clampSizeToDisplays(w: number, h: number): { w: number; h: number } {
  try {
    const displays = screen.getAllDisplays();
    let maxW = 0, maxH = 0;
    for (const d of displays) {
      if (d.workArea.width > maxW) maxW = d.workArea.width;
      if (d.workArea.height > maxH) maxH = d.workArea.height;
    }
    if (maxW > 0 && maxH > 0) {
      const clamped = { w: Math.min(w, maxW), h: Math.min(h, maxH) };
      if (clamped.w !== w || clamped.h !== h) {
        logWarn('Saved meter size exceeds display, clamping', { original: { w, h }, clamped, maxW, maxH });
      }
      return clamped;
    }
  } catch { /* screen may not be ready yet */ }
  return { w, h };
}

function loadLayoutFromDisk() {
  try {
    if (fs.existsSync(LAYOUT_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAYOUT_FILE, 'utf-8'));
      logDebug('Layout loaded from disk', data);
      if (data.x != null && data.y != null) meterOffset = { x: data.x, y: data.y };
      if (data.w != null && data.h != null) meterSize = clampSizeToDisplays(data.w, data.h);
      if (data.mapX != null && data.mapY != null) mapOffset = { x: data.mapX, y: data.mapY };
      if (data.mapW != null && data.mapH != null) mapSize = clampSizeToDisplays(data.mapW, data.mapH);
      if (data.mapVisible != null) mapVisible = data.mapVisible;
      if (data.mapDarkMode != null) mapSettings.darkMode = data.mapDarkMode;
      if (data.mapCenterOnPlayer != null) mapSettings.centerOnPlayer = data.mapCenterOnPlayer;
      if (data.mapZoomCache != null) mapSettings.zoomCache = data.mapZoomCache;
      return;
    }
  } catch (err: any) {
    logWarn('Failed to load layout from disk', { error: err.message });
  }
}

function saveCurrentLayout() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [wx, wy] = mainWindow.getPosition();
  const [w, h] = mainWindow.getSize();
  meterOffset = { x: wx - lastEqBounds.x, y: wy - lastEqBounds.y };
  meterSize = { w, h };
  try {
    let data: any = {};
    if (fs.existsSync(LAYOUT_FILE)) {
      try { data = JSON.parse(fs.readFileSync(LAYOUT_FILE, 'utf-8')); } catch { /* ignore */ }
    }
    data.x = meterOffset.x;
    data.y = meterOffset.y;
    data.w = w;
    data.h = h;
    // Save map window layout
    if (mapWindow && !mapWindow.isDestroyed()) {
      const [mx, my] = mapWindow.getPosition();
      const [mw, mh] = mapWindow.getSize();
      mapOffset = { x: mx - lastEqBounds.x, y: my - lastEqBounds.y };
      mapSize = { w: mw, h: mh };
    }
    data.mapX = mapOffset.x;
    data.mapY = mapOffset.y;
    data.mapW = mapSize.w;
    data.mapH = mapSize.h;
    data.mapVisible = mapVisible;
    if (mapSettings.darkMode != null) data.mapDarkMode = mapSettings.darkMode;
    if (mapSettings.centerOnPlayer != null) data.mapCenterOnPlayer = mapSettings.centerOnPlayer;
    if (mapSettings.zoomCache) data.mapZoomCache = mapSettings.zoomCache;
    fs.writeFileSync(LAYOUT_FILE, JSON.stringify(data));
    logDebug('Layout saved', { x: data.x, y: data.y, w, h, mapVisible });
  } catch (err: any) {
    logError('Failed to save layout', { error: err.message });
  }
}

// ── Class database persistence (LRU) ──
// Disk format: { "Name": { "cls": "Wizard", "seen": 1709766000000 }, ... }
// Entries older than MAX_AGE_MS are pruned on load. Capped at MAX_ENTRIES.
interface ClassDbEntry { cls: string; seen: number; }
const MAX_ENTRIES = 2000;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let classDb: Record<string, ClassDbEntry> = {};
let classDbDirty = false;
let classDbSaveTimer: ReturnType<typeof setTimeout> | null = null;

function loadClassDb() {
  try {
    if (!fs.existsSync(CLASSDB_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(CLASSDB_FILE, 'utf-8'));
    const now = Date.now();
    const cutoff = now - MAX_AGE_MS;
    let migrated = 0;
    let pruned = 0;

    for (const [name, value] of Object.entries(raw)) {
      if (typeof value === 'string') {
        // Migrate from old flat format: { "Name": "Wizard" }
        classDb[name] = { cls: value, seen: now };
        migrated++;
      } else if (value && typeof value === 'object' && 'cls' in (value as any)) {
        const entry = value as ClassDbEntry;
        if (entry.seen >= cutoff) {
          classDb[name] = entry;
        } else {
          pruned++;
        }
      }
    }

    // If over cap after loading, evict oldest
    const names = Object.keys(classDb);
    if (names.length > MAX_ENTRIES) {
      const sorted = names.sort((a, b) => classDb[a].seen - classDb[b].seen);
      const evictCount = sorted.length - MAX_ENTRIES;
      for (let i = 0; i < evictCount; i++) {
        delete classDb[sorted[i]];
        pruned++;
      }
    }

    logInfo('Class DB loaded', {
      entries: Object.keys(classDb).length,
      pruned,
      migrated: migrated > 0 ? migrated : undefined,
    });

    if (migrated > 0 || pruned > 0) {
      classDbDirty = true;
      saveClassDb();
    }
  } catch (err: any) {
    logWarn('Failed to load class DB', { error: err.message });
  }
}

function classDbToFlat(): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, entry] of Object.entries(classDb)) {
    flat[name] = entry.cls;
  }
  return flat;
}

function saveClassDb() {
  if (!classDbDirty) return;
  classDbDirty = false;
  try {
    fs.writeFileSync(CLASSDB_FILE, JSON.stringify(classDb));
    logDebug('Class DB saved', { entries: Object.keys(classDb).length });
  } catch (err: any) {
    logError('Failed to save class DB', { error: err.message });
  }
}

function scheduleClassDbSave() {
  classDbDirty = true;
  if (classDbSaveTimer) return;
  classDbSaveTimer = setTimeout(() => {
    classDbSaveTimer = null;
    saveClassDb();
  }, 5000);
}

function clampToVisibleScreen(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const MIN_VISIBLE = 40;
  const displays = screen.getAllDisplays();
  for (const d of displays) {
    const wa = d.workArea;
    if (
      x + w > wa.x + MIN_VISIBLE &&
      x < wa.x + wa.width - MIN_VISIBLE &&
      y + h > wa.y + MIN_VISIBLE &&
      y < wa.y + wa.height - MIN_VISIBLE
    ) {
      return { x, y };
    }
  }
  const primary = screen.getPrimaryDisplay().workArea;
  logWarn('Meter position off-screen, clamping to primary display', { x, y, w, h, primary });
  return {
    x: Math.max(primary.x, Math.min(x, primary.x + primary.width - w)),
    y: Math.max(primary.y, Math.min(y, primary.y + primary.height - h)),
  };
}

let repositionPending = false;
function repositionMeterToEQ() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (repositionPending) return;
  repositionPending = true;
  setImmediate(() => {
    repositionPending = false;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const raw = { x: lastEqBounds.x + meterOffset.x, y: lastEqBounds.y + meterOffset.y };
      const clamped = clampToVisibleScreen(raw.x, raw.y, meterSize.w, meterSize.h);
      mainWindow.setBounds({ x: clamped.x, y: clamped.y, width: meterSize.w, height: meterSize.h });
    } catch (err: any) {
      logError('repositionMeterToEQ native error', { message: err.message });
    }
  });
}

function findLogs(): { name: string; path: string; character: string; mtime: number }[] {
  try {
    const dirExists = fs.existsSync(LOGS_DIR);
    if (!dirExists) {
      logWarn('Logs directory does not exist', { LOGS_DIR });
      return [];
    }

    const allFiles = fs.readdirSync(LOGS_DIR);
    const logFiles = allFiles.filter(f => f.startsWith('eqlog_') && f.endsWith('.txt'));
    logDebug('Found log files', { count: logFiles.length, first5: logFiles.slice(0, 5) });

    const result = logFiles
      .map(f => {
        const full = path.join(LOGS_DIR, f);
        try {
          return {
            name: f,
            path: full,
            character: extractCharacterName(f),
            mtime: fs.statSync(full).mtime.getTime(),
          };
        } catch (err) {
          logWarn('Failed to stat log file', { file: f, error: String(err) });
          return null;
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => b.mtime - a.mtime);

    if (result.length > 0) {
      logInfo('Most recent log file', {
        file: result[0].name,
        character: result[0].character,
        mtime: new Date(result[0].mtime).toISOString(),
      });
    }

    return result;
  } catch (err) {
    logError('Failed to scan Logs directory', { LOGS_DIR, error: String(err) });
    return [];
  }
}

function createWindow() {
  logInfo('Creating windows');
  logDebug('Webpack entries', {
    renderer: MAIN_WINDOW_WEBPACK_ENTRY,
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
  });

  loadLayoutFromDisk();
  loadClassDb();
  const spellData = loadAllSpellData(EQ_DIR);
  spellDb = spellData.spellDb;
  landingMap = spellData.landingMap;
  landingSuffixes = Object.keys(landingMap);
  logInfo('Initial layout', { offset: meterOffset, size: meterSize });

  // ── 1. Tracking window ──
  // Tiny invisible window managed by electron-overlay-window.
  // Sole purpose: track EQ window position via moveresize events.
  try {
    trackingWindow = new BrowserWindow({
      ...OVERLAY_WINDOW_OPTS,
      width: 1,
      height: 1,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    trackingWindow.loadURL('about:blank');
    logInfo('Tracking window created');
  } catch (err: any) {
    logError('Failed to create tracking window', { message: err.message, stack: err.stack });
    return;
  }

  // ── 2. Main meter window ──
  // Sized to the meter only (NOT the full EQ window).
  // Transparent pixels pass through to EQ — no setIgnoreMouseEvents needed.
  try {
    const initPos = clampToVisibleScreen(
      lastEqBounds.x + meterOffset.x,
      lastEqBounds.y + meterOffset.y,
      meterSize.w,
      meterSize.h,
    );
    mainWindow = new BrowserWindow({
      width: meterSize.w,
      height: meterSize.h,
      x: initPos.x,
      y: initPos.y,
      transparent: true,
      frame: false,
      thickFrame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      webPreferences: {
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });
    logInfo('Main meter window created');
  } catch (err: any) {
    logError('Failed to create main window', { message: err.message, stack: err.stack });
    return;
  }

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  logInfo('Loading renderer URL', { url: MAIN_WINDOW_WEBPACK_ENTRY });

  mainWindow.webContents.on('did-finish-load', () => {
    logInfo('Renderer finished loading');
    if (currentLogStatus) {
      mainWindow!.webContents.send('log-status', currentLogStatus);
      logInfo('Sent log status to renderer', { character: currentLogStatus.character });
    }
    if (Object.keys(classDb).length > 0) {
      mainWindow!.webContents.send('class-db', classDbToFlat());
      logInfo('Sent class DB to renderer', { entries: Object.keys(classDb).length });
    }
    if (Object.keys(spellDb).length > 0) {
      mainWindow!.webContents.send('spell-db', spellDb);
      logInfo('Sent spell DB to renderer', { entries: Object.keys(spellDb).length });
    }
    if (Object.keys(landingMap).length > 0) {
      mainWindow!.webContents.send('landing-map', landingMap);
      logInfo('Sent landing map to renderer', { suffixes: Object.keys(landingMap).length });
    }
    if (!app.isPackaged) {
      mainWindow!.webContents.openDevTools({ mode: 'detach' });
      logInfo('DevTools opened (dev mode)');
    }
  });

  mainWindow.webContents.on('did-fail-load', (_ev, code, desc) => {
    logError('Renderer failed to load', { errorCode: code, description: desc });
  });

  mainWindow.webContents.on('console-message', (_ev, level, message) => {
    const labels = ['verbose', 'info', 'warning', 'error'];
    const label = labels[level] || String(level);
    if (level >= 2) {
      logWarn(`Renderer [${label}]: ${message}`);
    } else {
      logDebug(`Renderer [${label}]: ${message}`);
    }
  });

  mainWindow.on('closed', () => {
    logInfo('Main window closed');
    mainWindow = null;
    if (tooltipWindow && !tooltipWindow.isDestroyed()) tooltipWindow.close();
    tooltipWindow = null;
    if (mapWindow && !mapWindow.isDestroyed()) mapWindow.close();
    mapWindow = null;
    if (trackingWindow && !trackingWindow.isDestroyed()) trackingWindow.close();
  });

  // ── 2b. Tooltip window — separate transparent window for hover tooltips ──
  try {
    tooltipWindow = new BrowserWindow({
      parent: mainWindow,
      width: 320,
      height: 400,
      x: -9999,
      y: -9999,
      transparent: true,
      frame: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      hasShadow: false,
      resizable: false,
      show: false,
      webPreferences: {
        preload: TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });
    tooltipWindow.setAlwaysOnTop(true, 'screen-saver');
    tooltipWindow.setIgnoreMouseEvents(true);
    tooltipWindow.loadURL(TOOLTIP_WINDOW_WEBPACK_ENTRY);
    logInfo('Tooltip window created');
  } catch (err: any) {
    logError('Failed to create tooltip window', { message: err.message, stack: err.stack });
  }

  // ── 2c. Map window — separate overlay for zone map ──
  try {
    const mapInitPos = clampToVisibleScreen(
      lastEqBounds.x + mapOffset.x,
      lastEqBounds.y + mapOffset.y,
      mapSize.w,
      mapSize.h,
    );
    mapWindow = new BrowserWindow({
      width: mapSize.w,
      height: mapSize.h,
      x: mapInitPos.x,
      y: mapInitPos.y,
      transparent: true,
      frame: false,
      thickFrame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      show: false,
      webPreferences: {
        preload: MAP_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });
    mapWindow.setAlwaysOnTop(true, 'screen-saver');
    mapWindow.loadURL(MAP_WINDOW_WEBPACK_ENTRY);
    logInfo('Map window created');

    mapWindow.webContents.on('did-finish-load', () => {
      logInfo('Map renderer finished loading');
      sendToMap('map-load-settings', mapSettings);
      if (currentMapZone) {
        loadAndSendMapData(currentMapZone);
        sendToMap('map-zone-changed', currentMapZoneDisplay || currentMapZone);
      }
    });

    if (mapVisible) {
      mapWindow.showInactive();
    }
  } catch (err: any) {
    logError('Failed to create map window', { message: err.message, stack: err.stack });
  }

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  logInfo('alwaysOnTop set', { alwaysOnTop: mainWindow.isAlwaysOnTop() });

  for (const evt of ['show', 'hide', 'minimize', 'restore', 'blur', 'focus'] as const) {
    mainWindow.on(evt as any, () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      logInfo(`mainWindow.${evt}`, {
        visible: mainWindow.isVisible(),
        alwaysOnTop: mainWindow.isAlwaysOnTop(),
        bounds: mainWindow.getBounds(),
      });
    });
  }

  let lastLoggedSize = { w: 0, h: 0 };
  let sizeSnapInFlight = false;
  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const b = mainWindow.getBounds();

    // At fractional DPI, setBounds() may still produce a ±1 DIP size change
    // after the physical→DIP round-trip.  Snap the size back to the frozen
    // value so it can't accumulate.  Skip during intentional user resize.
    const target = dragFrozenSize ?? meterSize;
    if (!sizeSnapInFlight && !resizeStart && (b.width !== target.w || b.height !== target.h)) {
      sizeSnapInFlight = true;
      try { mainWindow.setSize(target.w, target.h); } catch { /* ignore */ }
      setTimeout(() => { sizeSnapInFlight = false; }, 32);
    }

    if (b.width !== lastLoggedSize.w || b.height !== lastLoggedSize.h) {
      logWarn('mainWindow.resize (unexpected)', {
        bounds: b,
        target,
        dragActive: !!dragFrozenSize,
      });
      lastLoggedSize = { w: b.width, h: b.height };
    }
  });

  mainWindow.showInactive();

  // ── 3. Overlay controller — attached to the TRACKING window ──
  OverlayController.events.on('attach', () => {
    logInfo('OverlayController: attached to EverQuest window');
    setTimeout(() => {
      if (trackingWindow && !trackingWindow.isDestroyed()) {
        const eqBounds = trackingWindow.getBounds();
        lastEqBounds = eqBounds;
        logInfo('EQ bounds from tracking window', eqBounds);
        repositionMeterToEQ();
      }
      startLogWatcher();
    }, 100);
  });

  OverlayController.events.on('detach', () => {
    logInfo('OverlayController: detached from EverQuest window — EQ closed, quitting meter');
    saveCurrentLayout();
    app.quit();
  });

  OverlayController.events.on('moveresize', (ev: { x: number; y: number; width: number; height: number }) => {
    lastEqBounds = { ...ev };
    repositionMeterToEQ();
    repositionMapToEQ();
  });

  logInfo('Calling OverlayController.attachByTitle("EverQuest") on tracking window...');
  try {
    OverlayController.attachByTitle(trackingWindow, 'EverQuest');
    logInfo('OverlayController.attachByTitle succeeded');
  } catch (err: any) {
    logError('OverlayController.attachByTitle failed', { message: err.message, stack: err.stack });
  }
}

/**
 * Scan the last portion of a log file for the most recent zone message.
 * Returns the display name (e.g. "Greater Faydark") or null.
 */
/**
 * Scan the log file backwards in chunks for the most recent zone message.
 * Starts at 2MB from end and doubles the window (up to 32MB) until found.
 */
function findLastZoneInLog(logFilePath: string): string | null {
  try {
    const stat = fs.statSync(logFilePath);
    const zoneEntryRe = /\] You have entered (.+?)\./g;
    const whoZoneRe = /\] There (?:are|is) \d+ players? in (.+?)\./g;
    let scanSize = 2 * 1024 * 1024;
    const maxScan = 32 * 1024 * 1024;

    while (scanSize <= maxScan) {
      const start = Math.max(0, stat.size - scanSize);
      const readLen = Math.min(scanSize, stat.size);
      const fd = fs.openSync(logFilePath, 'r');
      const buf = Buffer.alloc(readLen);
      fs.readSync(fd, buf, 0, readLen, start);
      fs.closeSync(fd);
      const text = buf.toString('utf-8');

      // Find the latest zone indicator from either source
      let lastMatch: string | null = null;
      let lastIndex = -1;
      let m: RegExpExecArray | null;

      while ((m = zoneEntryRe.exec(text)) !== null) {
        lastMatch = m[1];
        lastIndex = m.index;
      }
      while ((m = whoZoneRe.exec(text)) !== null) {
        if (m[1] !== 'EverQuest' && m.index > lastIndex) {
          lastMatch = m[1];
          lastIndex = m.index;
        }
      }

      if (lastMatch) return lastMatch;
      if (start === 0) break;
      scanSize *= 2;
    }
    return null;
  } catch {
    return null;
  }
}

function sendToMap(channel: string, data: any) {
  if (mapWindow && !mapWindow.isDestroyed()) {
    mapWindow.webContents.send(channel, data);
  }
}

function handleZoneChange(displayName: string) {
  const shortName = resolveZoneShortName(displayName);
  const forceReload = pendingZoneReload;
  pendingZoneReload = false;
  if (shortName === currentMapZone && !forceReload) return;
  currentMapZone = shortName;
  currentMapZoneDisplay = displayName;
  logInfo('Map zone change', { displayName, shortName, forced: forceReload });
  sendToMap('map-zone-changed', displayName);
  loadAndSendMapData(shortName);
}

function loadAndSendMapData(shortName: string) {
  try {
    const mapData = loadZoneMap(shortName, APP_DIR);
    if (mapData) {
      sendToMap('map-data', mapData);
      logInfo('Map data sent', { zone: shortName, lines: mapData.lines.length, labels: mapData.labels.length });
    } else {
      logWarn('No map data found for zone', { zone: shortName });
    }
  } catch (err: any) {
    logError('Failed to load map data', { zone: shortName, error: err.message });
  }
}

function repositionMapToEQ() {
  if (!mapWindow || mapWindow.isDestroyed()) return;
  try {
    const raw = { x: lastEqBounds.x + mapOffset.x, y: lastEqBounds.y + mapOffset.y };
    const clamped = clampToVisibleScreen(raw.x, raw.y, mapSize.w, mapSize.h);
    mapWindow.setBounds({ x: clamped.x, y: clamped.y, width: mapSize.w, height: mapSize.h });
  } catch (err: any) {
    logError('repositionMapToEQ native error', { message: err.message });
  }
}

let logRetryTimer: ReturnType<typeof setInterval> | null = null;

function stopLogRetry() {
  if (logRetryTimer) {
    clearInterval(logRetryTimer);
    logRetryTimer = null;
  }
}

function startLogWatcher() {
  stopLogWatcher();
  stopLogRetry();
  const logs = findLogs();
  const logFile = logs[0];

  if (!logFile) {
    logWarn('No EQ log files found — /log on must be enabled in-game. Retrying every 5s...');
    if (!logRetryTimer) {
      logRetryTimer = setInterval(() => {
        const retryLogs = findLogs();
        if (retryLogs.length > 0) {
          logInfo('Log file appeared, starting watcher');
          stopLogRetry();
          startLogWatcher();
        }
      }, 5000);
    }
    return;
  }
  if (!mainWindow) {
    logWarn('Cannot start log watcher — mainWindow is null');
    return;
  }

  logInfo('Starting log watcher', { file: logFile.name, character: logFile.character });

  currentWatchedLogPath = logFile.path;
  currentLogStatus = { attached: true, character: logFile.character, logFile: logFile.name };
  mainWindow.webContents.send('log-status', currentLogStatus);

  logWatcher = new LogWatcher(logFile.path, (events) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      logDebug('Sending combat events to renderer', { count: events.length });
      mainWindow.webContents.send('combat-events', events);
    }
    for (const evt of events) {
      if (evt.type === 'player_location' && evt.location) {
        sendToMap('player-location', evt.location);
      } else if (evt.type === 'loading_screen') {
        pendingZoneReload = true;
      } else if (evt.type === 'zone_change' && evt.target) {
        handleZoneChange(evt.target);
      }
    }
  });
  if (landingSuffixes.length > 0) {
    logWatcher.setLandingSuffixes(landingSuffixes);
  }
  logWatcher.setOnIdle(() => checkForLogSwitch());
  logWatcher.start();
  logInfo('Log watcher started and polling');

  // Detect current zone from log history so the map works without re-zoning
  if (!currentMapZone) {
    const lastZone = findLastZoneInLog(logFile.path);
    if (lastZone) {
      logInfo('Detected zone from log history', { zone: lastZone });
      handleZoneChange(lastZone);
    }
  }
}

function checkForLogSwitch() {
  if (!currentWatchedLogPath) return;
  const logs = findLogs();
  if (logs.length === 0) return;
  const newest = logs[0];
  if (newest.path === currentWatchedLogPath) return;

  logInfo('Character switch detected', {
    oldFile: path.basename(currentWatchedLogPath),
    newFile: newest.name,
    newCharacter: newest.character,
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reset');
  }
  startLogWatcher();
}

function stopLogWatcher() {
  if (logWatcher) {
    logWatcher.stop();
    logWatcher = null;
    logInfo('Log watcher stopped');
  }
}

function createTray() {
  logInfo('Creating system tray icon');
  try {
    const icon = nativeImage.createFromBuffer(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAADhJREFUOI1jYBhsgJGBgYGBgYGB4f///wwMDAwMf/78YWBgYGBgZGRkQBZgZGBgYGD4//8/AwMDAwMAYhkF/vGJxjcAAAAASUVORK5CYII=',
        'base64'
      )
    );
    tray = new Tray(icon);
    tray.setToolTip('P99 Damage Meter');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show/Hide',
        click: () => {
          if (mainWindow?.isVisible()) {
            mainWindow.hide();
            logInfo('User hid meter via tray');
          } else {
            mainWindow?.show();
            logInfo('User showed meter via tray');
          }
        },
      },
      {
        label: 'Reset Meter',
        click: () => {
          logInfo('Reset triggered from tray');
          mainWindow?.webContents.send('reset');
        },
      },
      {
        label: 'Reset Position',
        click: () => {
          logInfo('Reset position triggered from tray');
          if (!mainWindow || mainWindow.isDestroyed()) return;
          const primary = screen.getPrimaryDisplay().workArea;
          meterOffset = { ...DEFAULT_OFFSET };
          meterSize = { ...DEFAULT_SIZE };
          try {
            mainWindow.setBounds({
              x: primary.x + DEFAULT_OFFSET.x,
              y: primary.y + DEFAULT_OFFSET.y,
              width: DEFAULT_SIZE.w,
              height: DEFAULT_SIZE.h,
            });
          } catch (err: any) {
            logError('reset position setBounds native error', { message: err.message });
          }
          saveCurrentLayout();
        },
      },
      {
        label: 'Open Log File',
        click: () => {
          logInfo('Opening log file from tray menu');
          shell.openPath(getLogFilePath());
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { logInfo('Quit triggered from tray'); app.quit(); } },
    ]);
    tray.setContextMenu(contextMenu);
    logInfo('System tray created successfully');
  } catch (err: any) {
    logError('Failed to create tray', { message: err.message, stack: err.stack });
  }
}

if (gotLock) {
  app.on('ready', () => {
    logInfo('Electron app "ready" event fired');
    createTray();
    createWindow();
  });

  app.on('window-all-closed', () => {
    logInfo('All windows closed — quitting');
    app.quit();
  });

  app.on('before-quit', () => {
    stopLogWatcher();
    stopLogRetry();
    stopResizePolling();
    stopMapResizePolling();
    if (classDbSaveTimer) { clearTimeout(classDbSaveTimer); classDbSaveTimer = null; }
    classDbDirty = true;
    saveClassDb();
    saveCurrentLayout();
    logInfo('=== p99-meter shutting down ===');
  });
}

// ── IPC: Window movement (drag) ──
// At fractional DPI (e.g. 1.5×), Electron's DIP↔physical-pixel round-trip
// causes the reported size to drift by +1 DIP on every setPosition/setBounds
// call:  497 DIP → 745.5px → round(746px) → 746/1.5 = 497.33 → 498 DIP.
// To prevent this, we ALWAYS pass an explicit frozen size to setBounds()
// that was captured once (at drag-start or from the persisted layout).
// We never read getSize()/getBounds() to determine what size to set — that
// would create a feedback loop.  The frozen value maps to the same physical
// pixel count every time, so the OS sees no actual size change.
let dragFrozenSize: { w: number; h: number } | null = null;
let dragMoveCount = 0;

ipcMain.on('move-window', (_, x: number, y: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const size = dragFrozenSize ?? meterSize;
      const clamped = clampToVisibleScreen(Math.round(x), Math.round(y), size.w, size.h);
      mainWindow.setBounds({ x: clamped.x, y: clamped.y, width: size.w, height: size.h });
      dragMoveCount++;
      if (dragMoveCount <= 3 || dragMoveCount % 100 === 0) {
        const after = mainWindow.getBounds();
        logDebug('move-window', {
          requested: { x: Math.round(x), y: Math.round(y) },
          frozenSize: size,
          after: { x: after.x, y: after.y, w: after.width, h: after.height },
          n: dragMoveCount,
        });
      }
    } catch (err: any) {
      logError('move-window native error', { message: err.message });
    }
  }
});

ipcMain.on('drag-start', (_, data: { anchorX: number; anchorY: number; screenX: number; screenY: number }) => {
  dragMoveCount = 0;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [w, h] = mainWindow.getSize();
  dragFrozenSize = { w, h };
  logInfo('drag-start', {
    anchor: { x: data.anchorX, y: data.anchorY },
    screen: { x: data.screenX, y: data.screenY },
    windowBounds: mainWindow.getBounds(),
    frozenSize: dragFrozenSize,
    dpi: screen.getPrimaryDisplay().scaleFactor,
  });
});

ipcMain.on('drag-end', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  logInfo('drag-end', { finalBounds: bounds, totalMoves: dragMoveCount });
  dragFrozenSize = null;
  dragMoveCount = 0;
});

// ── IPC: Window resize (main-process cursor polling) ──
let resizeInterval: ReturnType<typeof setInterval> | null = null;
let resizeStart: { cursorX: number; cursorY: number; w: number; h: number } | null = null;
let resizeLastCursor = { x: 0, y: 0 };
let resizeIdleTicks = 0;
const MIN_RESIZE_W = 200;
const MIN_RESIZE_H = 100;

function stopResizePolling() {
  if (resizeInterval) {
    clearInterval(resizeInterval);
    resizeInterval = null;
  }
  if (resizeStart) {
    resizeStart = null;
    saveCurrentLayout();
    logDebug('Resize polling stopped, layout saved');
  }
}

ipcMain.on('start-resize', (_, data: { screenX: number; screenY: number }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [w, h] = mainWindow.getSize();
  resizeStart = { cursorX: data.screenX, cursorY: data.screenY, w, h };
  resizeLastCursor = { x: data.screenX, y: data.screenY };
  resizeIdleTicks = 0;
  logDebug('Resize polling started', { cursor: data, size: { w, h } });

  if (resizeInterval) clearInterval(resizeInterval);
  resizeInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !resizeStart) {
      stopResizePolling();
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - resizeStart.cursorX;
    const dy = cursor.y - resizeStart.cursorY;
    const newW = Math.max(MIN_RESIZE_W, resizeStart.w + dx);
    const newH = Math.max(MIN_RESIZE_H, resizeStart.h + dy);
    const [x, y] = mainWindow.getPosition();
    try {
      mainWindow.setBounds({ x, y, width: Math.round(newW), height: Math.round(newH) });
    } catch (err: any) {
      logError('resize setBounds native error', { message: err.message });
    }

    if (cursor.x === resizeLastCursor.x && cursor.y === resizeLastCursor.y) {
      resizeIdleTicks++;
      if (resizeIdleTicks > 60) {
        logDebug('Resize idle timeout — stopping');
        stopResizePolling();
      }
    } else {
      resizeIdleTicks = 0;
      resizeLastCursor = { x: cursor.x, y: cursor.y };
    }
  }, 16);
});

ipcMain.on('stop-resize', () => {
  stopResizePolling();
});

// ── IPC: Drag/resize finished — save layout ──
ipcMain.on('stop-drag-resize', () => {
  saveCurrentLayout();
});

ipcMain.on('reset', () => {
  logInfo('Reset triggered via IPC from renderer');
  mainWindow?.webContents.send('reset');
});

// Renderer can request current state (e.g. after HMR re-mount loses in-memory state)
ipcMain.on('request-status', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  logInfo('Renderer requested status re-send');
  if (currentLogStatus) {
    mainWindow.webContents.send('log-status', currentLogStatus);
  }
  if (Object.keys(classDb).length > 0) {
    mainWindow.webContents.send('class-db', classDbToFlat());
  }
  if (Object.keys(spellDb).length > 0) {
    mainWindow.webContents.send('spell-db', spellDb);
  }
  if (Object.keys(landingMap).length > 0) {
    mainWindow.webContents.send('landing-map', landingMap);
  }
  mainWindow.webContents.send('map-visibility', mapVisible);
});

// ── IPC: Tooltip (separate window) ──
ipcMain.on('show-tooltip', (_, data: { player: any; viewMode: string; barTop: number; barBottom: number }) => {
  if (!tooltipWindow || tooltipWindow.isDestroyed()) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const meterBounds = mainWindow.getBounds();
  const barScreenY = meterBounds.y + data.barTop;
  const barScreenBottom = meterBounds.y + data.barBottom;

  const display = screen.getDisplayMatching(meterBounds);
  const wa = display.workArea;
  const GAP = 4;

  const spaceAbove = barScreenY - wa.y - GAP;
  const spaceBelow = (wa.y + wa.height) - barScreenBottom - GAP;

  let tipX = meterBounds.x;
  let tipY: number;
  let tipH: number;
  let anchor: 'top' | 'bottom';

  if (spaceAbove > spaceBelow) {
    tipY = wa.y;
    tipH = barScreenY - wa.y - GAP;
    anchor = 'bottom';
  } else {
    tipY = barScreenBottom + GAP;
    tipH = (wa.y + wa.height) - barScreenBottom - GAP;
    anchor = 'top';
  }

  tipH = Math.max(50, tipH);

  try {
    tooltipWindow.setBounds({
      x: Math.round(tipX),
      y: Math.round(tipY),
      width: meterBounds.width,
      height: Math.round(tipH),
    });
  } catch (err: any) {
    logError('tooltip setBounds native error', { message: err.message });
    return;
  }
  tooltipWindow.webContents.send('tooltip-data', {
    player: data.player,
    viewMode: data.viewMode,
    anchor,
  });
  tooltipWindow.showInactive();
});

ipcMain.on('hide-tooltip', () => {
  if (!tooltipWindow || tooltipWindow.isDestroyed()) return;
  tooltipWindow.webContents.send('tooltip-hide');
  tooltipWindow.hide();
});

// ── IPC: Class DB persistence ──
ipcMain.on('save-class', (_, data: { name: string; cls: string }) => {
  if (!data.name || !data.cls) return;
  const existing = classDb[data.name];
  const now = Date.now();
  if (!existing || existing.cls !== data.cls) {
    classDb[data.name] = { cls: data.cls, seen: now };
    scheduleClassDbSave();
  } else if (now - existing.seen > 60_000) {
    existing.seen = now;
    scheduleClassDbSave();
  }
});

// ── IPC: Map window toggle ──
ipcMain.on('toggle-map', () => {
  if (!mapWindow || mapWindow.isDestroyed()) return;
  mapVisible = !mapVisible;
  logInfo('Map toggle', { visible: mapVisible });
  if (mapVisible) {
    repositionMapToEQ();
    mapWindow.showInactive();
    // If we already know the zone, send the map data
    if (currentMapZone) {
      loadAndSendMapData(currentMapZone);
    }
  } else {
    mapWindow.hide();
  }
  // Notify the meter renderer about visibility state
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('map-visibility', mapVisible);
  }
  saveCurrentLayout();
});

ipcMain.on('hide-map', () => {
  if (!mapWindow || mapWindow.isDestroyed()) return;
  mapVisible = false;
  mapWindow.hide();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('map-visibility', false);
  }
  saveCurrentLayout();
});

ipcMain.on('map-save-settings', (_: any, settings: any) => {
  if (settings.darkMode != null) mapSettings.darkMode = settings.darkMode;
  if (settings.centerOnPlayer != null) mapSettings.centerOnPlayer = settings.centerOnPlayer;
  if (settings.zoomCache) {
    if (!mapSettings.zoomCache) mapSettings.zoomCache = {};
    Object.assign(mapSettings.zoomCache, settings.zoomCache);
    // Cap at 50 entries
    const keys = Object.keys(mapSettings.zoomCache);
    if (keys.length > 50) {
      for (const k of keys.slice(0, keys.length - 50)) {
        delete mapSettings.zoomCache[k];
      }
    }
  }
  saveCurrentLayout();
});

// ── IPC: Map window drag ──
let mapDragFrozenSize: { w: number; h: number } | null = null;

ipcMain.on('map-move-window', (_, x: number, y: number) => {
  if (mapWindow && !mapWindow.isDestroyed()) {
    try {
      const size = mapDragFrozenSize ?? mapSize;
      const clamped = clampToVisibleScreen(Math.round(x), Math.round(y), size.w, size.h);
      mapWindow.setBounds({ x: clamped.x, y: clamped.y, width: size.w, height: size.h });
    } catch (err: any) {
      logError('map-move-window native error', { message: err.message });
    }
  }
});

ipcMain.on('map-drag-start', (_, data: { anchorX: number; anchorY: number; screenX: number; screenY: number }) => {
  if (!mapWindow || mapWindow.isDestroyed()) return;
  const [w, h] = mapWindow.getSize();
  mapDragFrozenSize = { w, h };
});

ipcMain.on('map-drag-end', () => {
  mapDragFrozenSize = null;
  saveCurrentLayout();
});

// ── IPC: Map window resize ──
let mapResizeInterval: ReturnType<typeof setInterval> | null = null;
let mapResizeStart: { cursorX: number; cursorY: number; w: number; h: number } | null = null;

function stopMapResizePolling() {
  if (mapResizeInterval) {
    clearInterval(mapResizeInterval);
    mapResizeInterval = null;
  }
  if (mapResizeStart) {
    mapResizeStart = null;
    saveCurrentLayout();
  }
}

ipcMain.on('map-resize-start', (_, data: { screenX: number; screenY: number }) => {
  if (!mapWindow || mapWindow.isDestroyed()) return;
  const [w, h] = mapWindow.getSize();
  mapResizeStart = { cursorX: data.screenX, cursorY: data.screenY, w, h };
  if (mapResizeInterval) clearInterval(mapResizeInterval);
  mapResizeInterval = setInterval(() => {
    if (!mapWindow || mapWindow.isDestroyed() || !mapResizeStart) {
      stopMapResizePolling();
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - mapResizeStart.cursorX;
    const dy = cursor.y - mapResizeStart.cursorY;
    const newW = Math.max(200, mapResizeStart.w + dx);
    const newH = Math.max(150, mapResizeStart.h + dy);
    const [x, y] = mapWindow.getPosition();
    try {
      mapWindow.setBounds({ x, y, width: Math.round(newW), height: Math.round(newH) });
    } catch (err: any) {
      logError('map resize setBounds error', { message: err.message });
    }
  }, 16);
});

ipcMain.on('map-resize-end', () => {
  stopMapResizePolling();
});
