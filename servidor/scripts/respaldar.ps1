# Copia de seguridad: base de datos + imágenes en servidor\copias\<fecha>\
. "$PSScriptRoot\comun.ps1"

Assert-Stack
$dest = Join-Path $script:Root ("copias\" + (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
New-Item -ItemType Directory -Force $dest | Out-Null

Write-Titulo 'Copiando base de datos'
Invoke-Compose @('exec', '-T', 'db', 'sh', '-c', 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/moscasstream.dump')
Invoke-Compose @('cp', 'db:/tmp/moscasstream.dump', (Join-Path $dest 'moscasstream.dump'))
Write-Ok 'moscasstream.dump'

Write-Titulo 'Copiando imágenes'
Invoke-Compose @('cp', 'api:/app/uploads', (Join-Path $dest 'uploads'))
Write-Ok "$((Get-ChildItem (Join-Path $dest 'uploads') -File -ErrorAction SilentlyContinue).Count) archivos"

Copy-Item $script:EnvFile (Join-Path $dest 'env-copia.txt')
Write-Host ''
Write-Host "  Copia lista en: $dest" -ForegroundColor Green
Write-Host '  Guárdala también fuera del PC (memoria USB o nube). Incluye una copia del .env: no la compartas.' -ForegroundColor Yellow
Write-Host ''
