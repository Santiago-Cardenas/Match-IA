# Hace que el servidor de imagenes y ngrok arranquen solos al iniciar sesion en Windows
# (crea un acceso en la carpeta de Inicio del usuario; no requiere permisos de administrador).
#
# Activar:  .\instalar-inicio.ps1 -Token "tu-clave" -Dominio "tu-dominio.ngrok-free.dev"
# Quitar:   .\instalar-inicio.ps1 -Quitar
param(
  [string]$Token,
  [string]$Dominio,
  [switch]$Quitar
)

$startup = [Environment]::GetFolderPath("Startup")
$cmd = Join-Path $startup "Matchia-imagenes.cmd"

if ($Quitar) {
  Remove-Item $cmd -ErrorAction SilentlyContinue
  Write-Host "Arranque automatico desactivado."
  exit 0
}

if (-not $Token -or -not $Dominio) {
  Write-Host 'Uso: .\instalar-inicio.ps1 -Token "tu-clave" -Dominio "tu-dominio.ngrok-free.dev"'
  exit 1
}

$start = Join-Path $PSScriptRoot "start.ps1"
$content = @"
@echo off
rem Matchia: servidor de imagenes (Qwen-Image 2.1) + tunel de ngrok. Creado por instalar-inicio.ps1
rem Espera 30 s para que la red y la GPU esten listas despues de iniciar sesion.
timeout /t 30 /nobreak >nul
start "Matchia - imagenes" powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "$start" -Token "$Token" -Dominio "$Dominio"
"@
Set-Content -Path $cmd -Value $content -Encoding ASCII
Write-Host "Listo: el servidor de imagenes arrancara solo al iniciar sesion."
Write-Host "Archivo: $cmd"
