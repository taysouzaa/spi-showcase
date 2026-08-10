<#
  Script de build para hospedagem estática.
  Compila o frontend e empacota o conteúdo de `dist` em um arquivo ZIP pronto para upload.
#>
param(
  [string]$OutFile = "spi-frontend-hostgator.zip"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$frontendDir = Join-Path $projectRoot "Frontend"
$distDir = Join-Path $frontendDir "dist"
$outPath = Join-Path $projectRoot $OutFile

Write-Host "Building Frontend..." -ForegroundColor Cyan
npm -C $frontendDir run build

if (!(Test-Path $distDir)) {
  throw "Build output not found: $distDir"
}

if (Test-Path $outPath) {
  # Remove ZIP anterior para evitar conteúdo desatualizado.
  Remove-Item $outPath -Force
}

Write-Host "Creating ZIP: $outPath" -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $distDir "*") -DestinationPath $outPath -Force

Write-Host "Done." -ForegroundColor Green
Write-Host "Upload the contents of the ZIP to your HostGator public_html (or the target folder)." -ForegroundColor Green
