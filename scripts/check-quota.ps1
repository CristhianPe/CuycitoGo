Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTICO DE ESTADO FIRESTORE - CuycitoGO     " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$utcNow = [DateTime]::UtcNow
$germanyTz = [TimeZoneInfo]::FindSystemTimeZoneById("W. Europe Standard Time")
$germanyNow = [TimeZoneInfo]::ConvertTimeFromUtc($utcNow, $germanyTz)
$resetTimeUtc = [DateTime]::UtcNow.Date.AddDays(1)
$resetTimeGermany = [TimeZoneInfo]::ConvertTimeFromUtc($resetTimeUtc, $germanyTz)
$hoursRemaining = [Math]::Round(($resetTimeUtc - $utcNow).TotalHours, 1)

Write-Host "Hora actual (Alemania):  $($germanyNow.ToString('HH:mm:ss'))" -ForegroundColor White
Write-Host "Proximo reinicio cuota: $($resetTimeGermany.ToString('HH:mm:ss')) (02:00 AM Alemania / 00:00 UTC)" -ForegroundColor Cyan
Write-Host "Tiempo restante:        Aprox. $hoursRemaining horas" -ForegroundColor Gray
Write-Host ""
Write-Host "Probando conexion con Cloud Firestore..." -ForegroundColor Gray

try {
    $url = "https://firestore.googleapis.com/v1/projects/cuycitogo-app/databases/(default)/documents/noticias?pageSize=1"
    $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    Write-Host ""
    Write-Host "[OK] Firestore esta ACTIVO y OPERATIVO." -ForegroundColor Green
    Write-Host "     Las lecturas y consultas estan funcionando con normalidad." -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host ""
    if ($statusCode -eq 429) {
        Write-Host "[LIMITE ALCANZADO] Cuota diaria de 50k lecturas agotada (HTTP 429)." -ForegroundColor Red
        Write-Host "                  El sistema se reiniciara gratis a las 02:00 AM (Alemania)." -ForegroundColor Yellow
        Write-Host "                  El portal de mantenimiento y la web siguen 100% online." -ForegroundColor White
    } else {
        Write-Host "[RESPUESTA]: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
