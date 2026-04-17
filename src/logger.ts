import * as fs from 'fs';
import * as path from 'path';

const MAX_LOG_SIZE = 5 * 1024 * 1024;

let logPath: string | null = null;
let logStream: fs.WriteStream | null = null;
let resolvedDataDir: string | null = null;

function isWritableDir(dir: string): boolean {
  const testFile = path.join(dir, '.p99-meter-write-test');
  try {
    fs.writeFileSync(testFile, '');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a directory the app can write config/log files to.
 * Prefers the exe directory (so files live alongside the app),
 * falls back to %APPDATA%/p99-meter when that isn't writable
 * (e.g. Program Files).
 */
export function getDataDir(): string {
  if (resolvedDataDir) return resolvedDataDir;

  const isPackaged = !process.execPath.includes('node_modules');
  const exeDir = path.dirname(process.execPath);
  const preferred = isPackaged ? exeDir : path.resolve(__dirname, '..', '..');

  if (isWritableDir(preferred)) {
    resolvedDataDir = preferred;
    return resolvedDataDir;
  }

  const appData = process.env.APPDATA || process.env.LOCALAPPDATA || '';
  const fallback = path.join(appData, 'p99-meter');
  try { fs.mkdirSync(fallback, { recursive: true }); } catch { /* ok */ }
  resolvedDataDir = fallback;
  return resolvedDataDir;
}

function resolveLogPath(): string {
  if (logPath) return logPath;
  logPath = path.join(getDataDir(), 'p99-meter.log');
  return logPath;
}

function ensureStream(): fs.WriteStream {
  if (!logStream) {
    const p = resolveLogPath();
    try {
      const stat = fs.statSync(p);
      if (stat.size > MAX_LOG_SIZE) {
        const old = p + '.old';
        try { fs.unlinkSync(old); } catch { /* ok */ }
        fs.renameSync(p, old);
      }
    } catch { /* file doesn't exist yet */ }

    logStream = fs.createWriteStream(p, { flags: 'a' });
  }
  return logStream;
}

function ts(): string {
  return new Date().toISOString();
}

export function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', msg: string, data?: unknown) {
  const line = data !== undefined
    ? `[${ts()}] ${level}: ${msg} ${JSON.stringify(data)}`
    : `[${ts()}] ${level}: ${msg}`;

  try {
    const stream = ensureStream();
    stream.write(line + '\n');
  } catch {
    // Last resort: if the stream fails, try a sync write
    try {
      fs.appendFileSync(resolveLogPath(), line + '\n');
    } catch { /* truly cannot log */ }
  }

  // In dev mode, also write to stdout for convenience
  const isPackaged = !process.execPath.includes('node_modules');
  if (!isPackaged) {
    console.log(line);
  }
}

export function logInfo(msg: string, data?: unknown) { log('INFO', msg, data); }
export function logWarn(msg: string, data?: unknown) { log('WARN', msg, data); }
export function logError(msg: string, data?: unknown) { log('ERROR', msg, data); }
export function logDebug(msg: string, data?: unknown) { log('DEBUG', msg, data); }

export function getLogFilePath(): string {
  return resolveLogPath();
}
