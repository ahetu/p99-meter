import * as fs from 'fs';
import { parseLine, tryMatchLanding, tryMatchCharmLanding, parseTimestamp, CombatEvent } from './logParser';
import { logInfo, logError, logWarn, logDebug } from './logger';
import { TIMESTAMP_RE, CHARM_LANDING_SUFFIXES } from './constants';

const POLL_MS = 250;
const INITIAL_TAIL = 256 * 1024;
const IDLE_THRESHOLD = 8; // consecutive empty polls before firing onIdle (~2 seconds)

export class LogWatcher {
  private filePath: string;
  private onEvents: (events: CombatEvent[]) => void;
  private onIdle: (() => void) | null = null;
  private position = 0;
  private lineBuffer = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private totalLinesRead = 0;
  private totalEventsEmitted = 0;
  private pollErrors = 0;
  private landingSuffixes: string[] = [];
  private idlePolls = 0;
  private backfillDone = false;

  constructor(filePath: string, onEvents: (events: CombatEvent[]) => void) {
    this.filePath = filePath;
    this.onEvents = onEvents;
  }

  setOnIdle(cb: () => void) { this.onIdle = cb; }

  setLandingSuffixes(suffixes: string[]) {
    // Sort longest-first for greedy matching
    this.landingSuffixes = suffixes.sort((a, b) => b.length - a.length);
    logInfo('Landing suffixes loaded', { count: suffixes.length });
  }

  start() {
    this.stop();
    logInfo('LogWatcher.start()', { file: this.filePath });

    try {
      const stat = fs.statSync(this.filePath);
      logInfo('Log file size', { bytes: stat.size, sizeKB: (stat.size / 1024).toFixed(1) });
      this.position = Math.max(0, stat.size - INITIAL_TAIL);
      logDebug('Starting from position', { position: this.position, tailKB: (INITIAL_TAIL / 1024).toFixed(0) });

      if (this.position > 0) {
        const fd = fs.openSync(this.filePath, 'r');
        const skipBuf = Buffer.alloc(512);
        const bytesRead = fs.readSync(fd, skipBuf, 0, 512, this.position);
        fs.closeSync(fd);
        const chunk = skipBuf.subarray(0, bytesRead).toString('utf-8');
        const nl = chunk.indexOf('\n');
        if (nl !== -1) {
          this.position += nl + 1;
          logDebug('Skipped to next complete line', { adjustedPosition: this.position });
        }
      }
    } catch (err) {
      logError('Failed to stat/read log file on start', { error: String(err) });
      this.position = 0;
    }

    this.lineBuffer = '';
    this.totalLinesRead = 0;
    this.totalEventsEmitted = 0;
    this.pollErrors = 0;
    this.timer = setInterval(() => this.poll(), POLL_MS);
    this.poll();
    this.backfillDone = true;
    this.idlePolls = 0;
    logInfo('LogWatcher polling started', { intervalMs: POLL_MS });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logInfo('LogWatcher stopped', {
        totalLinesRead: this.totalLinesRead,
        totalEventsEmitted: this.totalEventsEmitted,
        pollErrors: this.pollErrors,
      });
    }
  }

  private poll() {
    let size: number;
    try {
      size = fs.statSync(this.filePath).size;
    } catch (err) {
      this.pollErrors++;
      if (this.pollErrors <= 5) {
        logWarn('LogWatcher poll: failed to stat file', { error: String(err), errorCount: this.pollErrors });
      }
      return;
    }

    if (size <= this.position) {
      if (this.backfillDone) {
        this.idlePolls++;
        if (this.idlePolls >= IDLE_THRESHOLD && this.idlePolls % IDLE_THRESHOLD === 0 && this.onIdle) {
          this.onIdle();
        }
      }
      return;
    }
    this.idlePolls = 0;

    const readSize = size - this.position;
    let buf: Buffer;
    try {
      buf = Buffer.alloc(readSize);
      const fd = fs.openSync(this.filePath, 'r');
      fs.readSync(fd, buf, 0, readSize, this.position);
      fs.closeSync(fd);
    } catch (err) {
      this.pollErrors++;
      if (this.pollErrors <= 5) {
        logError('LogWatcher poll: failed to read file', { error: String(err), position: this.position, readSize });
      }
      return;
    }

    this.lineBuffer += buf.toString('utf-8');
    const lines = this.lineBuffer.split('\n');
    this.lineBuffer = lines.pop() || '';

    const events: CombatEvent[] = [];
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      this.totalLinesRead++;
      try {
        const parsed = parseLine(trimmed);
        if (parsed) {
          events.push(parsed);
        } else {
          const tsMatch = TIMESTAMP_RE.exec(trimmed);
          if (tsMatch) {
            const ts = parseTimestamp(tsMatch[1]);
            const msg = tsMatch[2];
            // Try spell landing match
            if (this.landingSuffixes.length > 0) {
              const landing = tryMatchLanding(msg, ts, this.landingSuffixes);
              if (landing) { events.push(landing); continue; }
            }
            // Try charm landing match
            const charm = tryMatchCharmLanding(msg, ts, CHARM_LANDING_SUFFIXES);
            if (charm) events.push(charm);
          }
        }
      } catch (err) {
        logWarn('Failed to parse line', { line: trimmed.substring(0, 120), error: String(err) });
      }
    }

    this.position = size;

    if (events.length > 0) {
      this.totalEventsEmitted += events.length;
      this.onEvents(events);
    }

    // Periodic stats every 1000 events
    if (this.totalEventsEmitted > 0 && this.totalEventsEmitted % 1000 === 0) {
      logInfo('LogWatcher stats', {
        totalLines: this.totalLinesRead,
        totalEvents: this.totalEventsEmitted,
        position: this.position,
        fileSize: size,
      });
    }
  }
}
