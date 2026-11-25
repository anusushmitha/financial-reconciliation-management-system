@echo off
setlocal
title LendGuard AI - Full Stack Launcher
color 0B
echo.
echo ==========================================================================
echo                     LENDGUARD AI — LAUNCHER IN PROGRESS
echo ==========================================================================
echo.
echo Starting all LendGuard AI services and verifying health...
echo Please wait a few seconds...
echo.

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_all.ps1"

echo.
echo ==========================================================================
echo Press any key to close this launcher window.
echo (All background services will continue running in the background)
echo To stop services at any time, double-click 'stop_all.bat'
echo ==========================================================================
pause >nul
