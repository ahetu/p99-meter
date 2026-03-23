// Logger must be imported first, before anything else
import { logInfo, logError, logWarn, logDebug, getLogFilePath } from './logger';

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
try {
  LogWatcher = require('./logWatcher').LogWatcher;
  extractCharacterName = require('./logParser').extractCharacterName;
  loadAllSpellData = require('./spellDatabase').loadAllSpellData;
  logInfo('Local modules loaded (logWatcher, logParser, spellDatabase)');
} catch (err: any) {
  logError('FATAL: Failed to load local modules', { message: err.message, stack: err.stack });
  process.exit(1);
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const TOOLTIP_WINDOW_WEBPACK_ENTRY: string;
declare const TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

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

const EQ_DIR = app.isPackaged
  ? path.resolve(path.dirname(app.getPath('exe')), '..')
  : path.resolve(__dirname, '..', '..', '..');
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
let lastEqBounds = { x: 0, y: 0, width: 1024, height: 768 };

// ── Layout persistence ──
const DEFAULT_OFFSET = { x: 20, y: 20 };
const DEFAULT_SIZE = { w: 320, h: 350 };
const LAYOUT_FILE = path.join(EQ_DIR, 'p99-meter-layout.json');
const CLASSDB_FILE = path.join(EQ_DIR, 'p99-meter-classdb.json');
logInfo('Persistence files', { LAYOUT_FILE, CLASSDB_FILE });

let meterOffset = { ...DEFAULT_OFFSET };
let meterSize = { ...DEFAULT_SIZE };
let spellDb: Record<string, import('./spellDatabase').SpellInfo> = {};
let landingMap: Record<string, import('./spellDatabase').LandingSpellInfo[]> = {};
let landingSuffixes: string[] = [];
let tooltipWindow: import('electron').BrowserWindow | null = null;

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
    fs.writeFileSync(LAYOUT_FILE, JSON.stringify(data));
    logDebug('Layout saved', { x: data.x, y: data.y, w, h });
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

function repositionMeterToEQ() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const raw = { x: lastEqBounds.x + meterOffset.x, y: lastEqBounds.y + meterOffset.y };
  const clamped = clampToVisibleScreen(raw.x, raw.y, meterSize.w, meterSize.h);
  const [w, h] = mainWindow.getSize();
  mainWindow.setBounds({ x: clamped.x, y: clamped.y, width: w, height: h });
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
  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const b = mainWindow.getBounds();
    if (b.width !== lastLoggedSize.w || b.height !== lastLoggedSize.h) {
      logWarn('mainWindow.resize (unexpected)', {
        bounds: b,
        dragActive: dragMoveCount > 0,
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
  });

  logInfo('Calling OverlayController.attachByTitle("EverQuest") on tracking window...');
  try {
    OverlayController.attachByTitle(trackingWindow, 'EverQuest');
    logInfo('OverlayController.attachByTitle succeeded');
  } catch (err: any) {
    logError('OverlayController.attachByTitle failed', { message: err.message, stack: err.stack });
  }
}

function startLogWatcher() {
  stopLogWatcher();
  const logs = findLogs();
  const logFile = logs[0];

  if (!logFile) {
    logWarn('No EQ log files found — /log on must be enabled in-game');
    return;
  }
  if (!mainWindow) {
    logWarn('Cannot start log watcher — mainWindow is null');
    return;
  }

  logInfo('Starting log watcher', { file: logFile.name, character: logFile.character });

  currentLogStatus = { attached: true, character: logFile.character, logFile: logFile.name };
  mainWindow.webContents.send('log-status', currentLogStatus);

  logWatcher = new LogWatcher(logFile.path, (events) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      logDebug('Sending combat events to renderer', { count: events.length });
      mainWindow.webContents.send('combat-events', events);
    }
  });
  if (landingSuffixes.length > 0) {
    logWatcher.setLandingSuffixes(landingSuffixes);
  }
  logWatcher.start();
  logInfo('Log watcher started and polling');
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
          mainWindow.setBounds({
            x: primary.x + DEFAULT_OFFSET.x,
            y: primary.y + DEFAULT_OFFSET.y,
            width: DEFAULT_SIZE.w,
            height: DEFAULT_SIZE.h,
          });
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
    stopResizePolling();
    if (classDbSaveTimer) { clearTimeout(classDbSaveTimer); classDbSaveTimer = null; }
    classDbDirty = true;
    saveClassDb();
    saveCurrentLayout();
    logInfo('=== p99-meter shutting down ===');
  });
}

// ── IPC: Window movement (drag) ──
// Freeze the window size at drag-start to avoid DPI rounding drift.
// At fractional scale factors (e.g. 1.5x), each setBounds → getSize
// round-trip can grow the size by 1 px due to logical↔physical rounding.
let dragFrozenSize: { w: number; h: number } | null = null;
let dragMoveCount = 0;

ipcMain.on('move-window', (_, x: number, y: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const size = dragFrozenSize ?? { w: mainWindow.getSize()[0], h: mainWindow.getSize()[1] };
    const clamped = clampToVisibleScreen(Math.round(x), Math.round(y), size.w, size.h);
    mainWindow.setBounds({ x: clamped.x, y: clamped.y, width: size.w, height: size.h });
    dragMoveCount++;
    if (dragMoveCount <= 3 || dragMoveCount % 100 === 0) {
      const after = mainWindow.getBounds();
      logDebug('move-window', {
        requested: { x: Math.round(x), y: Math.round(y) },
        frozenSize: size,
        after: { x: after.x, y: after.y, w: after.width, h: after.height },
        sizeChanged: size.w !== after.width || size.h !== after.height,
        n: dragMoveCount,
      });
    }
  }
});

ipcMain.on('drag-start', (_, data: { anchorX: number; anchorY: number; screenX: number; screenY: number }) => {
  dragMoveCount = 0;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  dragFrozenSize = { w: bounds.width, h: bounds.height };
  logInfo('drag-start', {
    anchor: { x: data.anchorX, y: data.anchorY },
    screen: { x: data.screenX, y: data.screenY },
    windowBounds: bounds,
    frozenSize: dragFrozenSize,
    dpi: screen.getPrimaryDisplay().scaleFactor,
  });
});

ipcMain.on('drag-end', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  logInfo('drag-end', { finalBounds: bounds, totalMoves: dragMoveCount });
  dragFrozenSize = null;
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
    mainWindow.setBounds({ x, y, width: Math.round(newW), height: Math.round(newH) });

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

  tooltipWindow.setBounds({
    x: Math.round(tipX),
    y: Math.round(tipY),
    width: meterBounds.width,
    height: Math.round(tipH),
  });
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
    // Same class, but refresh the timestamp (at most once per minute)
    existing.seen = now;
    scheduleClassDbSave();
  }
});
