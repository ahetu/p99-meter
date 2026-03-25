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

## Build & Deploy

```bash
npm run dist      # package + zip into out/
npm run deploy    # copy packaged app to EQ root p99-meter/ folder
```

## Distribution

Users extract `p99-meter-vX.Y.Z.zip` into their EverQuest directory and run `Setup.bat`. The meter auto-attaches when the EverQuest window appears.
