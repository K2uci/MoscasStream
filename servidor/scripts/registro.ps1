# Muestra en vivo lo que hace el servidor (incluido el avance de la importación). Ctrl+C para salir.
. "$PSScriptRoot\comun.ps1"

Assert-Stack
Write-Host ''
Write-Host '  Registro del servidor en vivo. Ctrl+C para salir (el servidor sigue encendido).' -ForegroundColor Cyan
Write-Host ''
$ErrorActionPreference = 'Continue'
& docker compose logs -f --tail 50 api
