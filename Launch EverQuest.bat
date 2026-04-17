@echo off
title P99 Damage Meter

:: Resolve paths relative to this batch file (inside the p99-meter folder)
set "METER_DIR=%~dp0"
for %%i in ("%~dp0..") do set "EQ_DIR=%%~fi"

if not exist "%EQ_DIR%\eqgame.exe" (
    echo.
    echo   [ERROR] eqgame.exe not found in parent directory.
    echo.
    echo   This folder must be inside your EverQuest directory.
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

if not exist "%METER_DIR%p99-meter.exe" (
    echo.
    echo   [ERROR] p99-meter.exe not found.
    echo.
    echo   The installation appears incomplete or corrupted.
    echo   Please re-download and extract the zip file.
    echo.
    pause
    exit /b 1
)

:: Kill any stale meter instance
taskkill /F /IM p99-meter.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Launch the damage meter.
:: Uses try/catch so Process::Start failures (permissions, SmartScreen) set exit code 1.
:: The path is inside the double-quoted -Command string, safe even with parens in paths.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "try { $psi = New-Object System.Diagnostics.ProcessStartInfo; $psi.FileName = '%METER_DIR%p99-meter.exe'; $psi.CreateNoWindow = $true; $psi.UseShellExecute = $false; [void][System.Diagnostics.Process]::Start($psi) } catch { exit 1 }"
if %errorlevel% neq 0 goto :launch_failed

:: Give the process a moment to start, then verify it's running
timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq p99-meter.exe" 2>nul | find /I "p99-meter.exe" >nul
if errorlevel 1 goto :meter_crashed
goto :meter_ok

:launch_failed
echo.
echo   [ERROR] Windows refused to start p99-meter.exe.
echo.
echo   Common fixes:
echo     1. Run Setup.bat first to unblock downloaded files
echo     2. Right-click p99-meter.exe, Properties, check "Unblock"
echo     3. Add the p99-meter folder to your antivirus exclusions
echo.
pause
exit /b 1

:meter_crashed
echo.
echo   [WARNING] p99-meter.exe started but exited immediately.
echo   It may have crashed on startup.
echo.
if exist "%METER_DIR%p99-meter.log" (
    echo   A log file exists at:
    echo     %METER_DIR%p99-meter.log
    echo   Please send this file for troubleshooting.
    echo.
    pause
    exit /b 1
)
if exist "%APPDATA%\p99-meter\p99-meter.log" (
    echo   A log file exists at:
    echo     %APPDATA%\p99-meter\p99-meter.log
    echo   Please send this file for troubleshooting.
    echo.
    pause
    exit /b 1
)
echo   No log file was created, which means it crashed very early.
echo.
echo   Try double-clicking p99-meter.exe directly to see if
echo   Windows shows an error dialog.
echo.
echo   Common causes:
echo     - Windows SmartScreen or antivirus blocked the app
echo     - Missing Visual C++ runtime (install from microsoft.com)
echo     - Run Setup.bat first to unblock downloaded files
echo.
pause
exit /b 1

:meter_ok
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
