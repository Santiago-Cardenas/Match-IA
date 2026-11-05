# Inicia el servidor de imágenes de Matchia (Qwen-Image 2.1) en http://127.0.0.1:8000
# y, si pasas -Dominio, abre el túnel de ngrok en otra ventana.
#
# Uso:
#   .\start.ps1 -Token "tu-clave" -Dominio "tu-dominio.ngrok-free.dev"
param(
  [string]$Token = $env:QWEN_IMAGE_TOKEN,
  [string]$Dominio = $env:QWEN_NGROK_DOMAIN
)

if (-not $Token) {
  Write-Host 'Falta la clave. Uso: .\start.ps1 -Token "tu-clave" -Dominio "tu-dominio.ngrok-free.dev"'
  exit 1
}

if ($Dominio) {
  $Dominio = $Dominio -replace '^https?://', '' -replace '/$', ''
  # --domain funciona en versiones viejas y nuevas del agente de ngrok.
  Start-Process ngrok -ArgumentList "http", "8000", "--domain=$Dominio"
  Write-Host "Túnel de ngrok abierto en otra ventana: https://$Dominio"
}

$env:QWEN_IMAGE_TOKEN = $Token
$env:PYTHONIOENCODING = "utf-8"
& "$env:USERPROFILE\matchia-qwen\.venv\Scripts\python.exe" "$PSScriptRoot\server.py"
