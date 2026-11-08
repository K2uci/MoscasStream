# Apaga el servidor. NO borra datos (no usa "down -v").
# Si había una importación a medias, continúa en el próximo arranque sin repetir lo ya agregado.
. "$PSScriptRoot\comun.ps1"

Assert-Docker
Invoke-Compose @('stop')
Write-Host ''
Write-Host '  Servidor apagado. Los datos se conservan.' -ForegroundColor Green
Write-Host ''
