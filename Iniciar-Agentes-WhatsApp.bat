@echo off
title Servidor de Agentes IA de WhatsApp - CuycitoGO
color 0A
echo ========================================================
echo   Iniciando Agentes IA de WhatsApp (Gemini + Firestore)
echo ========================================================
echo.
cd /d "%~dp0whatsapp_agent_service"

echo 1. Iniciando Servidor API de Agentes (Puerto 5001)...
start "Servidor API Agentes (5001)" cmd /k "node agent-server.js"

timeout /t 2 /nobreak >nul

echo 2. Iniciando Conector de WhatsApp (Baileys)...
start "Conector WhatsApp" cmd /k "node whatsapp-bridge.js"

echo.
echo ========================================================
echo   ¡Servicios iniciados correctamente!
echo   - Agente API: http://localhost:5001
echo   - WhatsApp: VINCULADO Y EN LÍNEA
echo ========================================================
pause
