@echo off
title CuycitoGo Bot Server
color 0A
cd /d "%~dp0whatsapp_agent_service"

echo ===============================================================
echo        CUYCITOGO - SERVIDOR DE AGENTES WHATSAPP 24/7
echo ===============================================================
echo.
echo [1/2] Iniciando Servidor API de CuycitoGo...
start "CuycitoGo-API" cmd /k "cd /d ""%~dp0whatsapp_agent_service"" && node agent-server.js"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Pasarela de WhatsApp...
start "CuycitoGo-WhatsApp" cmd /k "cd /d ""%~dp0whatsapp_agent_service"" && node whatsapp-bridge.js"

echo.
echo ===============================================================
echo  TODOS LOS SERVICIOS DE CUYCITOGO ESTAN CORRIENDO EN TU PC!
echo  Servidor API: http://localhost:5001
echo  Pasarela WhatsApp: Abierta en su propia ventana
echo ===============================================================
echo.
pause