@echo off
setlocal
title LendGuard AI - All-in-One Platform Controller
color 0B

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0lendguard.ps1" %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ==========================================================================
    echo An error occurred during execution.
    echo Check logs in 'logs\' for detailed diagnostics.
    echo ==========================================================================
    pause
)
