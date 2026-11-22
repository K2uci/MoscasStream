# Restaura el volcado de la base vieja en Neon, usando Docker (no hace falta instalar PostgreSQL).
# Uso (PowerShell, desde la carpeta servidor):
#   .\scripts\restaurar-en-neon.ps1 -Dump copias\pc-vieja\moscasstream.dump
# Te pedirá la cadena de conexión de Neon (Connect -> copiar). Reemplaza los datos actuales de esa base.
param([string]$Dump = 'copias\pc-vieja\moscasstream.dump')

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Dump)) { throw "No existe $Dump" }
$dumpFull = (Resolve-Path $Dump).Path

$url = Read-Host 'Cadena de conexión de Neon (postgres://...)'
# La librería de Node no soporta channel_binding; también se quita aquí por seguridad.
$url = $url -replace '[&?]channel_binding=require', ''
if ($url -notmatch '^postgres(ql)?://') { throw 'La cadena debe empezar por postgres://' }

$confirm = Read-Host 'Esto REEMPLAZA los datos de esa base. Escribe SI para continuar'
if ($confirm -ne 'SI') { Write-Host 'Cancelado.'; exit }

$img = 'postgres:17-alpine'
docker run --rm -v "${dumpFull}:/dump/m.dump:ro" $img `
  pg_restore --clean --if-exists --no-owner --no-acl -d $url /dump/m.dump
# pg_restore devuelve avisos inofensivos (p. ej. "no existe" al limpiar); lo importante es ver las tablas.

# Para que la migración de "animadas" se vuelva a aplicar sobre los datos restaurados.
docker run --rm $img psql $url -c "CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()); DELETE FROM migrations WHERE name='animated-types';"
docker run --rm $img psql $url -Atc "select type, count(*) from media group by 1 order by 2 desc"

Write-Host "`nListo. Ahora reinicia el servicio en Render (Manual Deploy -> Restart) para que cree el usuario admin y reclasifique las animadas."
