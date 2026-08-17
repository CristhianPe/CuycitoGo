# Script de Automatizacion de Configuracion de Flutter para CuzcitoGo Mobile

Write-Host "==========================================================" -ForegroundColor Gold
Write-Host "CuzcitoGO: Iniciando Instalacion y Setup de Flutter" -ForegroundColor Gold
Write-Host "==========================================================" -ForegroundColor Gold

# 1. Comprobar si Flutter esta instalado en el sistema
$flutterExists = Get-Command flutter -ErrorAction SilentlyContinue
if (-not $flutterExists) {
    Write-Host "Flutter no detectado en el PATH. Instalando via Winget..." -ForegroundColor Yellow
    
    # Intentar instalar Puro (Gestor moderno y rapido de versiones de Flutter)
    winget install --id pingbird.Puro -e --accept-package-agreements --accept-source-agreements
    
    # Recargar variables de entorno del sistema
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    
    # Comprobar si Puro esta listo
    $puroExists = Get-Command puro -ErrorAction SilentlyContinue
    if ($puroExists) {
        Write-Host "Configurando Flutter version estable via Puro..." -ForegroundColor Green
        puro create stable stable
        puro use -g stable
    } else {
        Write-Host "No se pudo instalar Puro automaticamente. Por favor descarga Flutter manualmente desde https://docs.flutter.dev/get-started/install/windows" -ForegroundColor Red
        Exit
    }
}

# 2. Asegurar que estamos en el directorio correcto
$projectRoot = "c:\Users\Cristhian\Desktop\CuzcitoGo"
Set-Location $projectRoot

# 3. Eliminar remanentes y crear el nuevo proyecto Flutter
Write-Host "Limpiando directorio movil antiguo..." -ForegroundColor Yellow
Remove-Item -Recurse -Force movil -ErrorAction SilentlyContinue

Write-Host "Creando nueva aplicacion de Flutter..." -ForegroundColor Green
flutter create --org com.cuycitogo --project-name cuzcitogo_app movil

Write-Host "Proyecto Flutter creado exitosamente!" -ForegroundColor Green
Write-Host "Ubicacion del proyecto: $projectRoot\movil" -ForegroundColor Gold
Write-Host "==========================================================" -ForegroundColor Gold
Write-Host "Ahora puedes abrir la carpeta movil directamente en VS Code o Android Studio." -ForegroundColor White
