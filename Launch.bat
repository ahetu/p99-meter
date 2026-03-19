@echo off
title P99 Damage Meter

set "EXE=%~dp0out\p99-meter-win32-x64\p99-meter.exe"

if exist "%EXE%" (
    start "" "%EXE%"
    exit /b
)

:: No built exe found — fall back to dev mode
echo No build found. Starting in dev mode...
echo Run "npm run make" to create a standalone build.
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download it from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "%~dp0node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

call npm start
