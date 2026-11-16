# Desliga o bot de vez (até o próximo login do Windows ou até rodar o iniciar-escondido.vbs).
$watchers = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
  Where-Object { $_.CommandLine -like '*manter-ligado.ps1*' }

foreach ($watcher in $watchers) {
  # O bot é o node que o vigia abriu. Fecha o vigia antes, senão ele liga o bot de novo.
  $bots = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($watcher.ProcessId) AND Name = 'node.exe'"
  Stop-Process -Id $watcher.ProcessId -Force
  foreach ($bot in $bots) { Stop-Process -Id $bot.ProcessId -Force }
}

Write-Host 'Bot desligado.'
