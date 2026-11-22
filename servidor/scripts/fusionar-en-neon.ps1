# FUSIONA la base vieja con la de Neon: conserva todo lo que ya hay en Neon y agrega solo los títulos
# de la base vieja que falten (se consideran repetidos si coincide el id, la referencia de TMDb,
# o el mismo título + tipo + año). No borra nada de Neon.
#
# Uso (PowerShell, desde la carpeta servidor, con Docker encendido):
#   .\scripts\fusionar-en-neon.ps1
# Te pedirá la cadena de conexión de Neon (Connect -> Copy snippet).
param([string]$Dump = 'copias\pc-vieja\moscasstream.dump')

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Dump)) { throw "No existe $Dump" }
$dumpFull = (Resolve-Path $Dump).Path

$url = Read-Host 'Cadena de conexión de Neon (postgres://...)'
$url = $url -replace '[&?]channel_binding=require', ''
if ($url -notmatch '^postgres(ql)?://') { throw 'La cadena debe empezar por postgres://' }

$img = 'postgres:17-alpine'
$tmp = 'moscas-old-tmp'
$work = Join-Path $env:TEMP 'moscas-fusion'
New-Item -ItemType Directory -Force $work | Out-Null

try {
  # 1) Base temporal local con el volcado viejo
  docker rm -f $tmp 2>$null | Out-Null
  docker run -d --name $tmp -e POSTGRES_PASSWORD=tmp -e POSTGRES_DB=old -v "${dumpFull}:/dump/m.dump:ro" $img | Out-Null
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep 1
    docker exec $tmp psql -U postgres -d old -c 'select 1' *> $null
    if ($LASTEXITCODE -eq 0) { break }
  }
  docker exec $tmp pg_restore -U postgres -d old --no-owner --no-acl /dump/m.dump 2>$null

  # 2) Exportar solo las columnas que existen en ambas versiones
  docker exec $tmp psql -U postgres -d old -v ON_ERROR_STOP=1 -c "ALTER TABLE media ADD COLUMN IF NOT EXISTS tmdb_ref TEXT; ALTER TABLE media ADD COLUMN IF NOT EXISTS import_key TEXT;"
  docker exec $tmp psql -U postgres -d old -v ON_ERROR_STOP=1 -c "\copy (SELECT id,title,type,poster_path,backdrop_path,rating,synopsis,year,genres,episodes,seasons,available,added_at,updated_at,tmdb_ref,import_key FROM media) TO '/tmp/media.tsv'"
  docker cp "${tmp}:/tmp/media.tsv" "$work\media.tsv"

  # 3) Fusionar en Neon (todo en una transacción: si algo falla, no cambia nada)
  @'
BEGIN;
DROP TABLE IF EXISTS media_old;
CREATE TABLE media_old (
  id UUID, title TEXT, type TEXT, poster_path TEXT, backdrop_path TEXT, rating NUMERIC(3,1), synopsis TEXT,
  year INT, genres TEXT[], episodes INT, seasons INT, available BOOLEAN, added_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ, tmdb_ref TEXT, import_key TEXT
);
\copy media_old FROM '/work/media.tsv'
SELECT count(*) AS "titulos_en_la_base_vieja" FROM media_old;
SELECT count(*) AS "titulos_en_neon_antes" FROM media;

WITH ins AS (
  INSERT INTO media (id,title,type,poster_path,backdrop_path,rating,synopsis,year,genres,episodes,seasons,available,added_at,updated_at,tmdb_ref,import_key)
  SELECT o.* FROM media_old o
  WHERE NOT EXISTS (
    SELECT 1 FROM media m
    WHERE m.id = o.id
       OR (o.tmdb_ref IS NOT NULL AND m.tmdb_ref = o.tmdb_ref)
       OR (lower(m.title) = lower(o.title) AND m.type = o.type AND coalesce(m.year,0) = coalesce(o.year,0))
  )
  RETURNING id
)
SELECT count(*) AS "agregados_desde_la_vieja" FROM ins;

-- Lo animado de la base vieja va a las secciones animadas.
UPDATE media m SET type = 'pelicula_animada'
  FROM media_old o WHERE m.id = o.id AND m.type = 'pelicula' AND m.genres && ARRAY['Animación','Animation','Animacion'];
UPDATE media m SET type = 'serie_animada'
  FROM media_old o WHERE m.id = o.id AND m.type = 'serie' AND m.genres && ARRAY['Animación','Animation','Animacion'];

UPDATE catalog_meta SET updated_at = now();
DROP TABLE media_old;
SELECT type, count(*) FROM media GROUP BY 1 ORDER BY 2 DESC;
COMMIT;
'@ | Set-Content -Encoding utf8 "$work\merge.sql"

  docker run --rm -v "${work}:/work" $img psql $url -v ON_ERROR_STOP=1 -f /work/merge.sql
  Write-Host "`nListo. La app mostrará los títulos nuevos en menos de 30 segundos."
  Write-Host 'Recuerda subir las imágenes con node scripts/subir-imagenes.mjs para que se vean los pósters.'
}
finally {
  docker rm -f $tmp 2>$null | Out-Null
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
