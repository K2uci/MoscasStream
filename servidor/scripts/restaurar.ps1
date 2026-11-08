# Restaura una copia de seguridad. REEMPLAZA los datos actuales.
# Uso: restaurar.bat                      -> la copia más reciente de servidor\copias
#      restaurar.bat C:\ruta\a\la\copia   -> esa carpeta
param(
  [string]$Carpeta,
  [switch]$Si   # no preguntar confirmación
)

. "$PSScriptRoot\comun.ps1"
$backup = Find-Backup $Carpeta
Assert-Stack

Write-Host ''
Write-Host "  Se restaurará la copia: $($backup.Folder)" -ForegroundColor Yellow
Write-Host '  Los títulos e imágenes actuales se REEMPLAZARÁN por los de la copia.' -ForegroundColor Yellow
if (-not $Si) {
  $ok = Read-Host '  Escribe SI para continuar'
  if ($ok -ne 'SI') { Write-Host '  Cancelado.'; exit 0 }
}

Write-Titulo 'Restaurando base de datos'
if ($backup.Format -eq 'dump') {
  Invoke-Compose @('cp', $backup.File, 'db:/tmp/restore.dump')
  Invoke-Compose @('exec', '-T', 'db', 'sh', '-c',
    'pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists --no-owner --role=$POSTGRES_USER /tmp/restore.dump')
} else {
  Invoke-Compose @('cp', $backup.File, 'db:/tmp/restore.sql')
  Invoke-Compose @('exec', '-T', 'db', 'sh', '-c', 'psql -q -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/restore.sql')
}
# Marca el catálogo como cambiado para que los teléfonos descarguen la versión restaurada.
Invoke-Compose @('exec', '-T', 'db', 'sh', '-c', 'psql -q -U $POSTGRES_USER -d $POSTGRES_DB -c ''UPDATE catalog_meta SET updated_at = now()''')
Write-Ok "Base de datos restaurada ($($backup.Format))"

Write-Titulo 'Restaurando imágenes'
$src = Join-Path $backup.Folder 'uploads'
if (Test-Path $src) {
  Invoke-Compose @('exec', '-T', '-u', 'root', 'api', 'sh', '-c', 'rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null; true')
  Invoke-Compose @('cp', "$src\.", 'api:/app/uploads/')
  Invoke-Compose @('exec', '-T', '-u', 'root', 'api', 'chown', '-R', 'node:node', '/app/uploads')
  Write-Ok "$((Get-ChildItem $src -File).Count) archivos"
}

Write-Host ''
Write-Host '  Restauración terminada.' -ForegroundColor Green
Write-Host ''
