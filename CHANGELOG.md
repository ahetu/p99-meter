# Changelog

## v1.0.4

- Fix: Window grew continuously while dragging on displays with fractional scaling (e.g. 150%). Root cause was DPI rounding drift — each setBounds/getSize round-trip added ~1px at non-integer scale factors. Window size is now frozen at drag-start.

## v1.0.3

- Debug: Added detailed drag/resize logging to p99-meter.log to diagnose window movement issues on other machines.

## v1.0.2

- Fix: Dragging the title bar simultaneously moved and resized the window on some Windows machines. Use explicit setBounds (with locked width/height) instead of setPosition to prevent size drift during drag.

## v1.0.1

- Fix: Window could not be dragged to move on Windows 11 — dragging the title bar triggered native resize instead. Disabled native resize borders since the meter uses its own resize grip.

## v1.0.0

- Initial release: real-time damage/healing/damage-taken meter overlay
- Spell correlation, class detection, pet tracking
- Tooltip details on hover (separate window)
- Overall and per-fight views
- Clipboard copy support
- System tray with show/hide, reset, and position reset
- Layout persistence across sessions
