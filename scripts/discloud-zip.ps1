# Monta o discloud.zip pra enviar no Discloud: só o necessário pros gifs, com a música desligada.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$staging = Join-Path ([IO.Path]::GetTempPath()) 'esdeath-discloud'
$zip = Join-Path $root 'discloud.zip'

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory $staging | Out-Null

# Sem package-lock: ele foi gerado no Windows e o Discloud roda Linux.
foreach ($item in 'discloud.config', 'package.json', 'src', 'assets') {
  Copy-Item (Join-Path $root $item) $staging -Recurse
}

# Mesmo .env daqui, mas com a música desligada (o plano grátis tem só 100 MB de memória).
$envLines = Get-Content (Join-Path $root '.env') | Where-Object { $_ -notmatch '^\s*MUSICA=' }
[IO.File]::WriteAllLines((Join-Path $staging '.env'), [string[]]($envLines + 'MUSICA=desligada'))

# Monta o zip na mão: o Compress-Archive do Windows grava "src\index.js" com barra invertida,
# e no Linux isso vira um arquivo com esse nome em vez de uma pasta.
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
if (Test-Path $zip) { Remove-Item $zip -Force }
$archive = [IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  foreach ($file in Get-ChildItem $staging -Recurse -File -Force) {
    $name = $file.FullName.Substring($staging.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $name) | Out-Null
  }
} finally {
  $archive.Dispose()
}
Remove-Item $staging -Recurse -Force

Write-Host "Pronto: $zip"
