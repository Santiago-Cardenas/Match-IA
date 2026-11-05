# Inicia el servidor de imágenes de Matchia (Qwen-Image 2.1) en http://127.0.0.1:8000
# Uso: .\start.ps1 -Token "la-misma-clave-que-QWEN_IMAGE_TOKEN-en-Render"
param([string]$Token = $env:QWEN_IMAGE_TOKEN)

if (-not $Token) {
  Write-Host 'Falta la clave. Uso: .\start.ps1 -Token "tu-clave"'
  exit 1
}
$env:QWEN_IMAGE_TOKEN = $Token
$env:PYTHONIOENCODING = "utf-8"
& "$env:USERPROFILE\matchia-qwen\.venv\Scripts\python.exe" "$PSScriptRoot\server.py"
