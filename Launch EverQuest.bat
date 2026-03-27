@echo off

:: Resolve paths relative to this batch file (inside the p99-meter folder)
set "METER_DIR=%~dp0"
for %%i in ("%~dp0..") do set "EQ_DIR=%%~fi"

if not exist "%EQ_DIR%\eqgame.exe" (
    echo [ERROR] eqgame.exe not found in %EQ_DIR%
    echo This folder must be inside your EverQuest directory.
    pause
    exit /b 1
)

:: Kill any stale meter instance
taskkill /F /IM p99-meter.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Launch the damage meter (hidden console — Electron is a console-subsystem exe)
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -FilePath '%METER_DIR%p99-meter.exe' -WindowStyle Hidden"

:: Launch EverQuest on a random CPU core (cores 1-8)
set /a _rand=%RANDOM%*8/32768+1
set _affinity=0x01
if %_rand% equ 2 set _affinity=0x02
if %_rand% equ 3 set _affinity=0x04
if %_rand% equ 4 set _affinity=0x08
if %_rand% equ 5 set _affinity=0x10
if %_rand% equ 6 set _affinity=0x20
if %_rand% equ 7 set _affinity=0x40
if %_rand% equ 8 set _affinity=0x80

cmd.exe /c start "EVERQUEST" /D "%EQ_DIR%" /affinity %_affinity% "%EQ_DIR%\eqgame.exe" patchme
