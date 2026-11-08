# Enciende el servidor en Docker (API + panel + PostgreSQL) e importa los listados de "importacion".
. "$PSScriptRoot\comun.ps1"

Write-Host ''
Write-Host '  Las MoscasStream - Servidor' -ForegroundColor Magenta

Initialize-DotEnv
Write-Titulo 'Comprobaciones'
Assert-Docker
Write-Ok 'Docker encendido'

$vars = Read-DotEnv
$port = Get-Valor $vars 'API_PORT' '3000'
$busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $n = (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName; $n -notlike 'com.docker*' -and $n -ne 'wslrelay' }
if ($busy) { Stop-ConError "El puerto $port está ocupado por otro programa. Ciérralo o cambia API_PORT en .env" }

Write-Titulo 'Construyendo y encendiendo (la primera vez tarda unos minutos)'
Invoke-Compose @('up', '-d', '--build')

$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-WebRequest "http://localhost:$port/api/health" -UseBasicParsing -TimeoutSec 3 | Out-Null
    $ok = $true
    break
  } catch { Start-Sleep -Seconds 2 }
}
$ErrorActionPreference = 'Stop'
if (-not $ok) { Stop-ConError 'El servidor no respondió. Revisa el registro con registro.bat' }
Write-Ok 'Servidor respondiendo'

Write-Titulo 'Servidor'
Write-Host "  Panel de administración:  http://localhost:$port" -ForegroundColor Green
$ips = @(Get-LanAddresses)
if ($ips.Count -gt 0) {
  Write-Host '  Dirección para la app Android (mantén pulsado el logo -> Conexión):' -ForegroundColor Green
  foreach ($ip in $ips) { Write-Host "      ${ip}:$port" -ForegroundColor White }
}

$pending = @(Get-ChildItem (Join-Path $script:Root 'importacion') -Filter '*.txt' -ErrorAction SilentlyContinue)
if ($pending.Count -gt 0) {
  Write-Host ''
  Write-Host "  Importando $($pending.Count) listado(s) de la carpeta importacion en segundo plano:" -ForegroundColor Cyan
  foreach ($f in $pending) { Write-Host "      $($f.Name)" }
  Write-Host '  TMDb permite 40 consultas por minuto: unos 15-20 títulos por minuto. Avance: registro.bat' -ForegroundColor Cyan
}
Write-Host ''
Write-Host '  El servidor sigue encendido aunque cierres esta ventana. Para apagarlo: detener.bat' -ForegroundColor Yellow
Write-Host ''
