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

:: Launch the damage meter without a visible console window.
:: CreateNoWindow suppresses the console (Electron is console-subsystem) without
:: setting SW_HIDE in STARTUPINFO, which would also hide the Electron GUI windows.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
    "$psi = New-Object System.Diagnostics.ProcessStartInfo; $psi.FileName = '%METER_DIR%p99-meter.exe'; $psi.CreateNoWindow = $true; $psi.UseShellExecute = $false; [void][System.Diagnostics.Process]::Start($psi)"

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
