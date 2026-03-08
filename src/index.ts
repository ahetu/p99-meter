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

const EQ_DIR = path.resolve(app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname, '..', '..', '..');
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
let tipExpanded = false;
let baseBounds: { x: number; y: number; width: number; height: number } | null = null;

function collapseTooltipExpansion() {
  if (!mainWindow || mainWindow.isDestroyed() || !tipExpanded) return;
  tipExpanded = false;
  if (baseBounds) {
    mainWindow.setBounds(baseBounds);
    baseBounds = null;
  }
}

function loadLayoutFromDisk() {
  try {
    if (fs.existsSync(LAYOUT_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAYOUT_FILE, 'utf-8'));
      logDebug('Layout loaded from disk', data);
      if (data.x != null && data.y != null) meterOffset = { x: data.x, y: data.y };
      if (data.w != null && data.h != null) meterSize = { w: data.w, h: data.h };
      return;
    }
  } catch (err: any) {
    logWarn('Failed to load layout from disk', { error: err.message });
  }
}

function saveCurrentLayout() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  collapseTooltipExpansion();
  const [wx, wy] = mainWindow.getPosition();
  const [w, h] = mainWindow.getSize();
  meterOffset = { x: wx - lastEqBounds.x, y: wy - lastEqBounds.y };
  meterSize = { w, h };
  const layout = { x: meterOffset.x, y: meterOffset.y, w, h };
  try {
    fs.writeFileSync(LAYOUT_FILE, JSON.stringify(layout));
    logDebug('Layout saved', layout);
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

function repositionMeterToEQ() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  collapseTooltipExpansion();
  const x = lastEqBounds.x + meterOffset.x;
  const y = lastEqBounds.y + meterOffset.y;
  mainWindow.setPosition(x, y);
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
    mainWindow = new BrowserWindow({
      width: meterSize.w,
      height: meterSize.h,
      x: lastEqBounds.x + meterOffset.x,
      y: lastEqBounds.y + meterOffset.y,
      transparent: true,
      frame: false,
      thickFrame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: true,
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
    if (trackingWindow && !trackingWindow.isDestroyed()) trackingWindow.close();
  });

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
        label: 'Reset',
        click: () => {
          logInfo('Reset triggered from tray');
          mainWindow?.webContents.send('reset');
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
ipcMain.on('move-window', (_, x: number, y: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setPosition(Math.round(x), Math.round(y));
  }
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
  collapseTooltipExpansion();
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

// ── IPC: Tooltip window expansion ──
ipcMain.on('expand-for-tooltip', () => {
  if (!mainWindow || mainWindow.isDestroyed() || tipExpanded) return;
  tipExpanded = true;
  baseBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(baseBounds);
  const wa = display.workArea;
  const maxBottom = wa.y + wa.height;
  const newHeight = Math.max(baseBounds.height, maxBottom - baseBounds.y);
  if (newHeight > baseBounds.height) {
    mainWindow.setBounds({ x: baseBounds.x, y: baseBounds.y, width: baseBounds.width, height: newHeight });
  }
});

ipcMain.on('collapse-tooltip', () => {
  collapseTooltipExpansion();
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
