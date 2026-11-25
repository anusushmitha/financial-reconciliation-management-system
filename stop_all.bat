@echo off
setlocal
title LendGuard AI - Stop All Services
color 0C
echo.
echo ==========================================================================
echo                    LENDGUARD AI — STOPPING ALL SERVICES
echo ==========================================================================
echo.

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop_all.ps1"

echo.
pause
