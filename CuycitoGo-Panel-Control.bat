@echo off
title CuycitoGo Control Manager
color 0E
cd /d "%~dp0whatsapp_agent_service"

echo ===============================================================
echo        CUYCITOGO - PANEL DE CONTROL DINAMICO 24/7
echo ===============================================================
echo.
echo Iniciando Centro de Control y Vinculacion por Codigo...
start "CuycitoGo-Manager-Core" /min cmd /k "cd /d ""%~dp0whatsapp_agent_service"" && node control-manager.js"

timeout /t 2 /nobreak >nul

echo Abriendo Panel de Control en tu navegador...
start http://localhost:5005

echo.
echo ===============================================================
echo  Panel de Control abierto en: http://localhost:5005
echo  Puedes minimizar esta ventana.
echo ===============================================================
echo.
pause