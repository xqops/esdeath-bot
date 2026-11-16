# Mantém o bot ligado: se ele cair, liga de novo depois de alguns segundos.
# Quem chama este script é o iniciar-escondido.vbs (sem janela), na pasta Inicializar do Windows.
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# Trava pra nunca rodar duas cópias (dois bots responderiam o mesmo comando).
$mutex = New-Object Threading.Mutex($false, 'Global\EsdeathBot')
if (-not $mutex.WaitOne(0)) { exit }

$log = Join-Path $root 'logs\bot.log'
New-Item -ItemType Directory (Split-Path $log) -Force | Out-Null

try {
  while ($true) {
    $proc = Start-Process node -ArgumentList 'src/index.js' -WorkingDirectory $root `
      -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $root 'logs\erro.txt')
    $proc.WaitForExit()

    $stamp = Get-Date -Format 'dd/MM/yyyy HH:mm:ss'
    Add-Content $log "[$stamp] ⚠️ O bot parou (código $($proc.ExitCode)). Ligando de novo em 10 segundos..." -Encoding utf8
    Start-Sleep -Seconds 10
  }
} finally {
  $mutex.ReleaseMutex()
}
