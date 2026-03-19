@echo off
title EQ Input Test
color 0E
echo.
echo ==========================================
echo   EQ Input Test - Double-click to run
echo ==========================================
echo.
echo ALT-TAB TO EVERQUEST NOW!
echo You have 5 seconds...
echo.
timeout /t 5 /nobreak
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diag-eq-input.ps1"
echo.
echo ==========================================
echo Did you see "test123" appear in EQ chat?
echo ==========================================
pause
