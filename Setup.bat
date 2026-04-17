@echo off
title P99 Damage Meter — Setup
echo.
echo   P99 Damage Meter — Setup
echo   ========================
echo.

:: Resolve paths
set "METER_DIR=%~dp0"
for %%i in ("%~dp0..") do set "EQ_DIR=%%~fi"

:: Verify the folder is inside the EQ directory
if not exist "%EQ_DIR%\eqgame.exe" (
    echo   [ERROR] eqgame.exe not found in parent directory!
    echo.
    echo   This folder must be placed inside your EverQuest directory.
    echo   Expected structure:
    echo.
    echo     Your EverQuest Folder\
    echo       eqgame.exe
    echo       p99-meter\           ^<-- this folder
    echo         Setup.bat
    echo         p99-meter.exe
    echo.
    pause
    exit /b 1
)

echo   EverQuest directory: %EQ_DIR%
echo.

:: Unblock files that Windows marks as "downloaded from the internet".
:: Without this, SmartScreen silently blocks the exe when launched via shortcut.
echo   Unblocking downloaded files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%METER_DIR%' -Recurse | Unblock-File -ErrorAction SilentlyContinue"
echo   Done.
echo.

:: Create desktop shortcut
echo   Creating desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell;" ^
    "$link = $ws.CreateShortcut([IO.Path]::Combine($ws.SpecialFolders('Desktop'), 'EverQuest P99.lnk'));" ^
    "$link.TargetPath = '%METER_DIR%Launch EverQuest.bat';" ^
    "$link.WorkingDirectory = '%METER_DIR%';" ^
    "$link.IconLocation = '%EQ_DIR%\eqgame.exe,0';" ^
    "$link.WindowStyle = 1;" ^
    "$link.Description = 'Launch EverQuest P99 with Damage Meter';" ^
    "$link.Save()"

if %errorlevel% equ 0 (
    echo   Desktop shortcut created: "EverQuest P99"
) else (
    echo   [WARNING] Could not create shortcut. You can run "Launch EverQuest.bat" directly.
)

echo.
echo   Setup complete!
echo.
echo   To play: Double-click the "EverQuest P99" shortcut on your desktop,
echo   or run "Launch EverQuest.bat" in this folder.
echo.
echo   IMPORTANT: Type /log on in-game for the damage meter to work.
echo.
pause
