@echo off
title CuycitoGO - Diagnostico de Cuota Firestore
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\check-quota.ps1"
echo.
pause
