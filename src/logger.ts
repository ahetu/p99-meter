import * as fs from 'fs';
import * as path from 'path';

const MAX_LOG_SIZE = 5 * 1024 * 1024;

let logPath: string | null = null;
let logStream: fs.WriteStream | null = null;

function resolveLogPath(): string {
  if (logPath) return logPath;

  // Use process.execPath to work even before app.ready
  const exeDir = path.dirname(process.execPath);

  // In dev mode (__dirname is .webpack/main), walk up to project root
  const isPackaged = !process.execPath.includes('node_modules');
  const dir = isPackaged ? exeDir : path.resolve(__dirname, '..', '..');

  logPath = path.join(dir, 'p99-meter.log');
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
