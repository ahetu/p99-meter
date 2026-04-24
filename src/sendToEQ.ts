import { logInfo, logError } from './logger';
import { execFile, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface ReportResult {
  success: boolean;
  error?: string;
  linesSent?: number;
}

const CS_INPUT_CLASS = `using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Text;

public class EQInput
{
    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT
    {
        public uint type;
        public InputUnion u;
    }

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const ushort VK_RETURN = 0x0D;

    static IntPtr eqHwnd = IntPtr.Zero;

    static IntPtr FindEQWindow()
    {
        eqHwnd = IntPtr.Zero;
        EnumWindows((hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd)) return true;
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            if (sb.ToString().Contains("EverQuest"))
            {
                eqHwnd = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return eqHwnd;
    }

    static void PressKey(ushort vk)
    {
        int size = Marshal.SizeOf(typeof(INPUT));
        var inputs = new INPUT[2];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].u.ki.wVk = vk;
        inputs[1].type = INPUT_KEYBOARD;
        inputs[1].u.ki.wVk = vk;
        inputs[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
        SendInput(2, inputs, size);
    }

    static void TypeUnicode(string text)
    {
        int size = Marshal.SizeOf(typeof(INPUT));
        foreach (char c in text)
        {
            var inputs = new INPUT[2];
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].u.ki.wScan = (ushort)c;
            inputs[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].u.ki.wScan = (ushort)c;
            inputs[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
            SendInput(2, inputs, size);
            Thread.Sleep(2);
        }
    }

    public static string Send(string[] lines)
    {
        IntPtr hwnd = FindEQWindow();
        if (hwnd == IntPtr.Zero) return "ERROR:EQ_NOT_FOUND";

        SetForegroundWindow(hwnd);
        Thread.Sleep(300);

        int sent = 0;
        for (int i = 0; i < lines.Length; i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i])) continue;
            PressKey(VK_RETURN);
            Thread.Sleep(80);
            TypeUnicode(lines[i]);
            Thread.Sleep(80);
            PressKey(VK_RETURN);
            sent++;
            if (i < lines.Length - 1)
                Thread.Sleep(700);
        }

        return "OK:" + sent;
    }
}`;

function ensureTempDir(): string {
  const dir = path.join(os.tmpdir(), 'p99meter');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function psStringEscape(s: string): string {
  return s.replace(/'/g, "''");
}

let _elevated: boolean | null = null;
function isAlreadyElevated(): boolean {
  if (_elevated !== null) return _elevated;
  try {
    execSync('net session', { windowsHide: true, stdio: 'ignore' });
    _elevated = true;
  } catch {
    _elevated = false;
  }
  logInfo('sendToEQ: elevation check', { elevated: _elevated });
  return _elevated;
}

function buildWorkerScript(linesFile: string, resultFile: string): string {
  return "$linesFile = '" + psStringEscape(linesFile) + "'\n" +
    "$resultFile = '" + psStringEscape(resultFile) + "'\n" +
    "\n" +
    "Add-Type -TypeDefinition @'\n" +
    CS_INPUT_CLASS + "\n" +
    "'@\n" +
    "\n" +
    "try {\n" +
    "    [string[]]$allLines = [System.IO.File]::ReadAllLines($linesFile, [System.Text.Encoding]::UTF8)\n" +
    "    $result = [EQInput]::Send($allLines)\n" +
    "    [System.IO.File]::WriteAllText($resultFile, $result, [System.Text.Encoding]::UTF8)\n" +
    "} catch {\n" +
    "    [System.IO.File]::WriteAllText($resultFile, \"ERROR:EXCEPTION:$($_.Exception.Message)\", [System.Text.Encoding]::UTF8)\n" +
    "}\n";
}

function buildLauncherScript(workerPath: string, resultFile: string): string {
  const wp = psStringEscape(workerPath);
  const rf = psStringEscape(resultFile);
  return "try {\n" +
    '    Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList "-ExecutionPolicy Bypass -File ""' + wp + '""""' + "\n" +
    "} catch {\n" +
    "    [System.IO.File]::WriteAllText('" + rf + "', 'ERROR:UAC_DENIED', [System.Text.Encoding]::UTF8)\n" +
    "}\n";
}

function cleanup(...files: string[]) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
}

export async function reportToGame(lines: string[], channelPrefix: string): Promise<ReportResult> {
  const fullLines = lines.map(l => channelPrefix ? channelPrefix + ' ' + l : l);

  const ts = Date.now();
  const tmpDir = ensureTempDir();
  const linesFile = path.join(tmpDir, 'lines-' + ts + '.txt');
  const resultFile = path.join(tmpDir, 'result-' + ts + '.txt');
  const workerFile = path.join(tmpDir, 'worker-' + ts + '.ps1');
  const launcherFile = path.join(tmpDir, 'launcher-' + ts + '.ps1');

  fs.writeFileSync(linesFile, fullLines.join('\r\n'), 'utf-8');
  fs.writeFileSync(workerFile, buildWorkerScript(linesFile, resultFile), 'utf-8');

  const elevated = isAlreadyElevated();
  logInfo('sendToEQ: prepared', {
    lineCount: fullLines.length,
    prefix: channelPrefix || '(none)',
    elevated,
  });

  if (elevated) {
    return runDirect(workerFile, resultFile, linesFile);
  } else {
    fs.writeFileSync(launcherFile, buildLauncherScript(workerFile, resultFile), 'utf-8');
    return runElevated(launcherFile, workerFile, resultFile, linesFile);
  }
}

function runDirect(workerFile: string, resultFile: string, linesFile: string): Promise<ReportResult> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', workerFile],
      { timeout: 30000, windowsHide: true },
      (_err) => {
        resolve(readResult(resultFile, [workerFile, resultFile, linesFile]));
      }
    );
  });
}

function runElevated(launcherFile: string, workerFile: string, resultFile: string, linesFile: string): Promise<ReportResult> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', launcherFile],
      { timeout: 30000, windowsHide: true },
      (_err) => {
        resolve(readResult(resultFile, [launcherFile, workerFile, resultFile, linesFile]));
      }
    );
  });
}

function readResult(resultFile: string, cleanupFiles: string[]): ReportResult {
  let result = '';
  try {
    result = fs.readFileSync(resultFile, 'utf-8').trim();
  } catch { /* result file not created */ }

  cleanup(...cleanupFiles);
  logInfo('sendToEQ: completed', { result });

  if (result.startsWith('OK:')) {
    const count = parseInt(result.split(':')[1], 10);
    return { success: true, linesSent: count };
  }
  if (result === 'ERROR:EQ_NOT_FOUND') {
    return { success: false, error: 'EverQuest window not found' };
  }
  if (result === 'ERROR:UAC_DENIED') {
    return { success: false, error: 'Admin permission needed — approve the UAC prompt to send input to EQ' };
  }
  if (result.startsWith('ERROR:EXCEPTION:')) {
    return { success: false, error: result.substring('ERROR:EXCEPTION:'.length) };
  }
  return { success: false, error: result || 'No response — the UAC prompt may have been dismissed' };
}
