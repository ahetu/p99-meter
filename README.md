# P99 Damage Meter

A Details!-style damage meter overlay for EverQuest Project 1999, built with Electron.

## Features

- **In-game overlay** that attaches to and follows the EverQuest window
- **Real-time log parsing** of EQ combat logs
- **Damage Done / Healing / Damage Taken** tabs
- **Fight segmentation** with per-fight and overall views
- **Hover tooltips** with detailed breakdowns (melee/spell split, accuracy, max hit)
- **Draggable panel** with saved position
- **Click-through** on transparent areas — input passes to EQ
- **System tray** icon with show/hide and reset

## How It Works

Reads the EverQuest log file (`/log on` in-game) and parses combat lines with regex. No game injection — purely reads the text log.

## Development

```bash
npm install
npm start
```

EverQuest must be running (windowed mode) for the overlay to attach.

## Build

```bash
npm run make
```

Output goes to `out/make/` as a portable zip and/or Squirrel installer.

## Auto-Launch with EQ

Add this line to `Run_Everquest.bat`:

```batch
start "" "Z:\Everquest P99\p99-meter\out\p99-meter-win32-x64\p99-meter.exe"
```

The meter starts in the tray and auto-attaches when the EverQuest window appears.
