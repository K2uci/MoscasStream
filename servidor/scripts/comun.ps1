# Funciones compartidas por los scripts del servidor de Las MoscasStream (Docker).
# Compatible con Windows PowerShell 5.1.

$ErrorActionPreference = 'Stop'
$script:Root = Split-Path -Parent $PSScriptRoot   # carpeta "servidor"
$script:EnvFile = Join-Path $script:Root '.env'

function Write-Titulo([string]$texto) {
  Write-Host ''
  Write-Host "== $texto ==" -ForegroundColor Cyan
}

function Write-Ok([string]$texto) { Write-Host "  [OK] $texto" -ForegroundColor Green }
function Write-Aviso([string]$texto) { Write-Host "  [!] $texto" -ForegroundColor Yellow }

function Stop-ConError([string]$texto) {
  Write-Host ''
  Write-Host "  [X] $texto" -ForegroundColor Red
  Write-Host ''
  exit 1
}

# ---------- .env ----------

function Read-DotEnv {
  $vars = [ordered]@{}
  if (-not (Test-Path $script:EnvFile)) { return $vars }
  foreach ($line in [System.IO.File]::ReadAllLines($script:EnvFile)) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"')
  }
  return $vars
}

function Set-DotEnvValue([string]$Key, [string]$Value) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.AddRange([System.IO.File]::ReadAllLines($script:EnvFile))
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") { $lines[$i] = "$Key=$Value"; $found = $true }
  }
  if (-not $found) { $lines.Add("$Key=$Value") }
  [System.IO.File]::WriteAllLines($script:EnvFile, $lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Valor($vars, [string]$key, [string]$default) {
  if ($vars.Contains($key) -and $vars[$key]) { return $vars[$key] }
  return $default
}

function New-Secreto([int]$bytes = 24) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return ([Convert]::ToBase64String($buf)).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

# Primera vez: crea el .env desde .env.example con contraseñas aleatorias y pregunta la del panel.
function Initialize-DotEnv {
  if (Test-Path $script:EnvFile) { return }
  Write-Titulo 'Primera vez: creando la configuración (.env)'
  Copy-Item (Join-Path $script:Root '.env.example') $script:EnvFile
  $user = Read-Host '  Usuario para entrar al panel (Enter = admin)'
  if (-not $user) { $user = 'admin' }
  do {
    $s = Read-Host '  Contraseña para el panel (mínimo 8 caracteres)' -AsSecureString
    $pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
  } while ($pass.Length -lt 8)
  Set-DotEnvValue 'ADMIN_USER' $user
  Set-DotEnvValue 'ADMIN_PASSWORD' $pass
  Set-DotEnvValue 'POSTGRES_PASSWORD' (New-Secreto 18)
  Set-DotEnvValue 'JWT_SECRET' (New-Secreto 32)
  Write-Ok '.env creado. Si tienes token de TMDb, ponlo en TMDB_TOKEN para el autocompletado y la importación.'
}

# ---------- Docker ----------

# Comprueba Docker; si Docker Desktop está cerrado, lo abre y espera.
function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-ConError 'No se encontró Docker. Instala Docker Desktop: https://www.docker.com/products/docker-desktop/'
  }
  $ErrorActionPreference = 'Continue'
  docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (Test-Path $desktop) {
      Write-Host '  Abriendo Docker Desktop (puede tardar un minuto)...'
      Start-Process $desktop
      for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 3
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { break }
      }
    }
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { Stop-ConError 'Docker no está encendido. Abre Docker Desktop, espera a "Engine running" y vuelve a intentar.' }
  }
  Set-Location $script:Root
}

# Ejecuta "docker compose" mostrando la salida; corta el script si falla.
function Invoke-Compose([string[]]$ComposeArgs) {
  $ErrorActionPreference = 'Continue'
  & docker compose @ComposeArgs
  if ($LASTEXITCODE -ne 0) { Stop-ConError "docker compose $($ComposeArgs -join ' ') falló" }
}

function Assert-Stack {
  Assert-Docker
  $ErrorActionPreference = 'Continue'
  $running = docker compose ps --status running --services 2>$null
  if (-not ($running -contains 'db') -or -not ($running -contains 'api')) {
    Stop-ConError 'El servidor no está encendido. Ejecuta primero iniciar.bat'
  }
}

function Get-LanAddresses {
  try {
    return Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and
        $_.InterfaceAlias -notlike 'vEthernet*' -and $_.InterfaceAlias -notlike '*Loopback*'
      } |
      Select-Object -ExpandProperty IPAddress
  } catch {
    return @()
  }
}

# ---------- Copias de seguridad ----------

# Carpeta de la copia y su archivo de datos: moscasstream.dump (respaldar.bat) o moscasstream.sql.
function Find-Backup([string]$Carpeta) {
  if (-not $Carpeta) {
    $latest = Get-ChildItem (Join-Path $script:Root 'copias') -Directory -ErrorAction SilentlyContinue |
      Where-Object { (Test-Path (Join-Path $_.FullName 'moscasstream.dump')) -or (Test-Path (Join-Path $_.FullName 'moscasstream.sql')) } |
      Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latest) { Stop-ConError 'No hay copias en servidor\copias' }
    $Carpeta = $latest.FullName
  }
  $Carpeta = [System.IO.Path]::GetFullPath($Carpeta)
  foreach ($name in @('moscasstream.dump', 'moscasstream.sql')) {
    $f = Join-Path $Carpeta $name
    if (Test-Path $f) { return @{ Folder = $Carpeta; File = $f; Format = [System.IO.Path]::GetExtension($name).TrimStart('.') } }
  }
  Stop-ConError "La carpeta $Carpeta no contiene moscasstream.dump ni moscasstream.sql"
}
