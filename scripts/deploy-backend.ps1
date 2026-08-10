# =============================================================================
#  SPI — Deploy do Backend no AWS Elastic Beanstalk
#
#  O que este script faz:
#   1. Instala a EB CLI (se não tiver)
#   2. Entra na pasta Backend e instala dependências
#   3. Compila o TypeScript para dist/
#   4. Roda as migrations do Prisma no banco RDS
#   5. Inicializa o projeto no Elastic Beanstalk (só na primeira vez)
#   6. Sobe as variáveis de ambiente do .env para o EB
#   7. Faz o deploy
#
#  Como rodar:
#    .\scripts\deploy-backend.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$BackendDir = Join-Path $PSScriptRoot ".." "Backend"
$Region     = "sa-east-1"
$AppName    = "spi-backend"
$EnvName    = "spi-backend-env"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SPI — Deploy Backend (Elastic Beanstalk)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar / instalar EB CLI ────────────────────────────────────────────
Write-Host "[1/6] Verificando EB CLI..." -ForegroundColor Yellow
$ebVersion = eb --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  EB CLI não encontrada. Instalando via pip..." -ForegroundColor DarkYellow
    pip install awsebcli --upgrade --quiet
    Write-Host "  EB CLI instalada." -ForegroundColor Green
} else {
    Write-Host "  OK — $ebVersion" -ForegroundColor Green
}

# ── 2. Build TypeScript ───────────────────────────────────────────────────────
Write-Host "[2/6] Compilando TypeScript..." -ForegroundColor Yellow
Set-Location $BackendDir
npm install
npm run build
Write-Host "  Build concluído — pasta dist/ gerada." -ForegroundColor Green

# ── 3. Migrations no RDS ─────────────────────────────────────────────────────
Write-Host "[3/6] Rodando migrations Prisma no RDS..." -ForegroundColor Yellow
npx prisma migrate deploy
Write-Host "  Migrations aplicadas." -ForegroundColor Green

# ── 4. Inicializar EB (só na primeira vez) ────────────────────────────────────
Write-Host "[4/6] Inicializando Elastic Beanstalk..." -ForegroundColor Yellow
if (-not (Test-Path ".elasticbeanstalk\config.yml")) {
    eb init $AppName --platform "Node.js 20" --region $Region
    Write-Host "  EB inicializado." -ForegroundColor Green
} else {
    Write-Host "  Já inicializado, pulando." -ForegroundColor DarkYellow
}

# ── 5. Criar ambiente (só na primeira vez) ────────────────────────────────────
$envExists = eb list 2>&1 | Select-String $EnvName
if (-not $envExists) {
    Write-Host "[5/6] Criando ambiente $EnvName (t3.micro)..." -ForegroundColor Yellow
    eb create $EnvName `
        --instance-type t3.micro `
        --single `
        --region $Region
    Write-Host "  Ambiente criado." -ForegroundColor Green
} else {
    Write-Host "[5/6] Ambiente $EnvName já existe." -ForegroundColor DarkYellow
}

# ── 6. Subir variáveis de ambiente do .env ────────────────────────────────────
Write-Host "[6/6] Sincronizando variáveis de ambiente..." -ForegroundColor Yellow

$envVars = @{}
Get-Content ".env" | Where-Object { $_ -match "^\s*[^#]" -and $_ -match "=" } | ForEach-Object {
    $parts = $_ -split "=", 2
    $key   = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    if ($key) { $envVars[$key] = $value }
}

$envString = ($envVars.GetEnumerator() | ForEach-Object { "$($_.Key)=`"$($_.Value)`"" }) -join " "
Invoke-Expression "eb setenv $envString"
Write-Host "  Variáveis sincronizadas." -ForegroundColor Green

# ── 7. Deploy ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Fazendo deploy..." -ForegroundColor Cyan
eb deploy $EnvName

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DEPLOY CONCLUÍDO!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

$url = eb status $EnvName | Select-String "CNAME" | ForEach-Object { $_ -replace ".*CNAME: ", "" }
Write-Host "  URL do backend: http://$url" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Próximo passo: adicione esta URL no CORS_ORIGINS do .env" -ForegroundColor Yellow
Write-Host "  e atualize o VITE_API_URL no frontend." -ForegroundColor Yellow
Write-Host ""
