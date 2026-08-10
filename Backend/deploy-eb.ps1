# deploy-eb.ps1
# Compila o backend TypeScript e gera o pacote ZIP para deploy no Elastic Beanstalk.
#
# Como usar:
#   1. Abra o PowerShell na pasta Backend/
#   2. Execute: .\deploy-eb.ps1
#   3. O arquivo spi-backend-deploy.zip será gerado nesta pasta
#   4. Faça upload desse zip no console do Elastic Beanstalk

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$OutputZip = "spi-backend-deploy.zip"

Write-Host ""
Write-Host "=== SPI Backend — Deploy Elastic Beanstalk ===" -ForegroundColor Cyan
Write-Host ""

# 1. Instala dependencias (caso necessario)
Write-Host "[1/4] Instalando dependencias..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }

# 2. Compila TypeScript + gera Prisma Client
Write-Host ""
Write-Host "[2/4] Compilando (prisma generate + tsc)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build falhou" }

# 3. Remove zip anterior se existir
if (Test-Path $OutputZip) {
    Remove-Item $OutputZip -Force
    Write-Host ""
    Write-Host "[3/4] ZIP anterior removido." -ForegroundColor DarkGray
}

# 4. Empacota apenas o necessario para o EB
Write-Host ""
Write-Host "[3/4] Empacotando para deploy..." -ForegroundColor Yellow

$filesToZip = @(
    "dist",
    "prisma",
    ".ebextensions",
    "Procfile",
    "package.json",
    "package-lock.json"
)

# Verifica quais existem antes de zipar
$existing = $filesToZip | Where-Object { Test-Path $_ }

Compress-Archive -Path $existing -DestinationPath $OutputZip -Force

$zipSize = [math]::Round((Get-Item $OutputZip).Length / 1MB, 2)

Write-Host ""
Write-Host "[4/4] Pronto!" -ForegroundColor Green
Write-Host ""
Write-Host "  Arquivo gerado : $OutputZip ($zipSize MB)" -ForegroundColor White
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Abra o console AWS Elastic Beanstalk"
Write-Host "     https://console.aws.amazon.com/elasticbeanstalk"
Write-Host "  2. Selecione o ambiente: spi-backend-env"
Write-Host "  3. Clique em 'Carregar e implantar'"
Write-Host "  4. Selecione o arquivo: $OutputZip"
Write-Host "  5. Defina uma versao (ex: v2.0-phone-auth)"
Write-Host "  6. Clique em 'Implantar'"
Write-Host ""
Write-Host "  Lembre-se de configurar as variaveis de ambiente no EB:" -ForegroundColor Yellow
Write-Host "    DATABASE_URL, DIRECT_URL, JWT_SECRET, JWT_REFRESH_SECRET"
Write-Host "    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET"
Write-Host "    ADMIN_EMAIL, ADMIN_PHONE, ADMIN_NAME, CORS_ORIGINS"
Write-Host ""
