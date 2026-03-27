P99 Damage Meter
================

A Details!-style damage meter overlay for EverQuest Project 1999.


INSTALL
-------
1. Extract the p99-meter folder into your EverQuest directory so it
   sits next to eqgame.exe:

     Your EverQuest Folder\
       eqgame.exe
       p99-meter\        <-- this folder
         Setup.bat
         p99-meter.exe
         ...

2. Run Setup.bat (inside the p99-meter folder).
   This creates an "EverQuest P99" shortcut on your desktop.

3. Use the desktop shortcut to launch EverQuest.
   It starts both the damage meter and the game automatically.


IMPORTANT
---------
- Type  /log on  in-game for the damage meter to work.
- EverQuest must be in WINDOWED mode (not fullscreen).


UPDATING
--------
To update, extract the new zip over the existing p99-meter folder
(overwrite all files) and re-run Setup.bat.


HOW IT WORKS
------------
Reads the EverQuest log file and parses combat lines in real time.
No game injection -- purely reads the text log.

- Drag the title bar to move the meter.
- Drag the bottom-right corner to resize.
- Right-click the system tray icon for options (show/hide, reset, quit).
- Transparent areas are click-through -- input passes to EQ.
