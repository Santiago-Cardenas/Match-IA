# Inicia el servidor de imagenes de Matchia (Qwen-Image 2.1) y el tunel de ngrok, y los mantiene vivos:
# si el servidor o ngrok se caen o dejan de responder, los vuelve a abrir solos.
#
# Uso:
#   .\start.ps1 -Token "tu-clave" -Dominio "tu-dominio.ngrok-free.dev"
# Para detenerlo: Ctrl+C en esta ventana.
param(
  [string]$Token = $env:QWEN_IMAGE_TOKEN,
  [string]$Dominio = $env:QWEN_NGROK_DOMAIN
)

if (-not $Token) {
  Write-Host 'Falta la clave. Uso: .\start.ps1 -Token "tu-clave" -Dominio "tu-dominio.ngrok-free.dev"'
  exit 1
}

$py = "$env:USERPROFILE\matchia-qwen\.venv\Scripts\python.exe"
$server = Join-Path $PSScriptRoot "server.py"
$env:QWEN_IMAGE_TOKEN = $Token
$env:PYTHONIOENCODING = "utf-8"
if ($Dominio) { $Dominio = $Dominio -replace '^https?://', '' -replace '/$', '' }

function Log([string]$msg) {
  Write-Host ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg) -ForegroundColor Cyan
}

function Start-Server {
  Log "Iniciando servidor de imagenes..."
  Start-Process -FilePath $py -ArgumentList "`"$server`"" -NoNewWindow -PassThru
}

function Start-Ngrok {
  Log "Abriendo tunel de ngrok: https://$Dominio"
  # --domain funciona en versiones viejas y nuevas del agente de ngrok.
  Start-Process ngrok -ArgumentList "http", "8000", "--domain=$Dominio" -WindowStyle Minimized -PassThru
}

function Test-Tunnel {
  try {
    $t = Invoke-RestMethod "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 10
    return ($t.tunnels.Count -gt 0)
  } catch { return $false }
}

# Cierra lo que haya quedado abierto de una ejecucion anterior (puerto 8000 y ngrok con este dominio).
$old = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($old) { Stop-Process -Id $old.OwningProcess -Force -ErrorAction SilentlyContinue }
if ($Dominio) {
  Get-CimInstance Win32_Process -Filter "Name='ngrok.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$Dominio*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

$srv = Start-Server
$srvStart = Get-Date
$ng = if ($Dominio) { Start-Ngrok } else { $null }
$srvFails = 0
$ngFails = 0

try {
  while ($true) {
    Start-Sleep -Seconds 20

    # 1) El servidor se cerro (por ejemplo, un error nativo de PyTorch): se vuelve a abrir.
    if ($srv.HasExited) {
      Log "El servidor se cerro. Reiniciando en 5 s..."
      Start-Sleep -Seconds 5
      $srv = Start-Server
      $srvStart = Get-Date
      $srvFails = 0
      continue
    }

    # 2) ngrok se cerro o perdio el tunel: se vuelve a abrir.
    if ($Dominio) {
      if ($ng.HasExited) {
        Log "ngrok se cerro. Reabriendo..."
        $ng = Start-Ngrok
        $ngFails = 0
      } elseif (-not (Test-Tunnel)) {
        $ngFails++
        if ($ngFails -ge 3) {
          Log "El tunel de ngrok no esta activo. Reabriendo..."
          Stop-Process -Id $ng.Id -Force -ErrorAction SilentlyContinue
          Start-Sleep -Seconds 3
          $ng = Start-Ngrok
          $ngFails = 0
        }
      } else {
        $ngFails = 0
      }
    }

    # 3) El servidor sigue abierto pero no responde (o la GPU quedo mal): se reinicia.
    if (((Get-Date) - $srvStart).TotalSeconds -lt 120) { continue } # tiempo para cargar el modelo
    try {
      Invoke-WebRequest "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 30 | Out-Null
      $srvFails = 0
    } catch {
      $srvFails++
      Log "El servidor no responde ($srvFails/3)."
      if ($srvFails -ge 3) {
        Log "Reiniciando servidor..."
        Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 5
        $srv = Start-Server
        $srvStart = Get-Date
        $srvFails = 0
      }
    }
  }
} finally {
  # Ctrl+C: cierra tambien ngrok y el servidor.
  if ($ng -and -not $ng.HasExited) { Stop-Process -Id $ng.Id -Force -ErrorAction SilentlyContinue }
  if ($srv -and -not $srv.HasExited) { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
}
