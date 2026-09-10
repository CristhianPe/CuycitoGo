@echo off
title CuycitoGO - Centro de Control
cd /d "%~dp0"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "scripts\gui-control-panel.ps1"
exit
