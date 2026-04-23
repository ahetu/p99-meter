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

:: Detect CPU topology for optimal EverQuest core affinity.
:: Hybrid Intel CPUs have P-cores (performance) and E-cores (efficiency).
:: EQ is single-threaded; we want an affinity mask that covers only P-cores
:: so Windows doesn't schedule it onto a weak E-core or onto a core that a
:: background app (e.g., Unreal Editor shader workers) is hammering.
echo   Detecting CPU topology...
set "PS_SCRIPT=%TEMP%\eq-detect-cpu.ps1"
(
echo $ErrorActionPreference = 'Stop'
echo $cpu = Get-CimInstance Win32_Processor ^| Select-Object -First 1
echo $name = $cpu.Name
echo $cores = [int]$cpu.NumberOfCores
echo $logical = [int]$cpu.NumberOfLogicalProcessors
echo $mask = 0xFF
echo $desc = 'default: first 8 threads'
echo if ^($name -match '1[2-4]th Gen Intel^|Core\s*Ultra'^) {
echo     $p = $logical - $cores
echo     if ^($p -gt 0 -and $p -lt $cores^) {
echo         $e = $cores - $p
echo         $pl = $p * 2
echo         $mask = ^([long]1 -shl [Math]::Min^($pl, 63^)^) - 1
echo         $desc = "Intel hybrid: ${p}P + ${e}E, mask covers $pl P-core threads"
echo     }
echo } elseif ^($name -match 'AMD' -and $cores -gt 8^) {
echo     $h = [int]^($logical / 2^)
echo     $mask = ^([long]1 -shl [Math]::Min^($h, 63^)^) - 1
echo     $desc = "AMD multi-CCD: first CCD = $h threads"
echo } else {
echo     $desc = "$cores cores, $logical threads"
echo }
echo $hex = '0x{0:X}' -f $mask
echo Set-Content -Path $args[0] -Value $hex -NoNewline -Encoding ASCII
echo Write-Host "  CPU: $name"
echo Write-Host "  Topology: $cores cores, $logical threads"
echo Write-Host "  Affinity: $hex -- $desc"
) > "%PS_SCRIPT%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" "%METER_DIR%affinity.cfg"
if %errorlevel% neq 0 (
    echo   [WARNING] CPU detection failed. Using default affinity 0xFF.
    >"%METER_DIR%affinity.cfg" echo 0xFF
)
del "%PS_SCRIPT%" 2>nul
echo.

echo.
echo   Setup complete!
echo.
echo   To play: Double-click the "EverQuest P99" shortcut on your desktop,
echo   or run "Launch EverQuest.bat" in this folder.
echo.
echo   IMPORTANT: Type /log on in-game for the damage meter to work.
echo.
pause
