<#
  Script de desenvolvimento local.
  Abre dois terminais PowerShell: backend e frontend em modo watch.
#>
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

# Inicializa backend em uma nova janela.
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "cd `"$projectRoot\\Backend`"; npm run dev"
)

# Inicializa frontend em uma nova janela.
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "cd `"$projectRoot\\Frontend`"; npm run dev"
)
