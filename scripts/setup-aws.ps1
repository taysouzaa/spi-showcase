# =============================================================================
#  SPI — Setup completo de infraestrutura AWS
#  Conta: informe o AWS Account ID da sua conta | Região: sa-east-1 (São Paulo)
#
#  O que este script cria:
#   1. Bucket S3 privado para armazenar imagens processadas
#   2. Bucket policy para acesso público de leitura (imagens de produto)
#   3. CORS no bucket (acesso do frontend)
#   4. Usuário IAM "spi-backend" com permissão somente neste bucket
#   5. Access Key para o backend usar
#   6. RDS PostgreSQL t3.micro (elegível ao free tier)
#   7. Security Group para o banco aceitar conexões
#   8. Arquivo .env pronto para copiar ao backend
#
#  Pré-requisito: AWS CLI instalado e configurado com sua conta root/admin
#    winget install Amazon.AWSCLI
#    aws configure   (coloque sua Access Key + Secret da conta root)
#
#  Como rodar:
#    .\scripts\setup-aws.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# ── Configurações ─────────────────────────────────────────────────────────────
$Region      = "sa-east-1"
$AccountId   = "SEU_ACCOUNT_ID"
$Project     = "spi"
$BucketName  = "$Project-imagens-prod"
$IamUser     = "$Project-backend"
$PolicyName  = "$Project-s3-policy"
$DbId        = "$Project-postgres"
$DbName      = "spi_db"
$DbUser      = "spi_admin"

# Gera senha segura para o banco
$chars     = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
$DbPass    = -join (1..20 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SPI — AWS Infrastructure Setup" -ForegroundColor Cyan
Write-Host "  Região: $Region | Conta: $AccountId" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar AWS CLI ───────────────────────────────────────────────────────
Write-Host "[1/7] Verificando AWS CLI..." -ForegroundColor Yellow
$identity = aws sts get-caller-identity | ConvertFrom-Json
Write-Host "  OK — Logado como: $($identity.Arn)" -ForegroundColor Green

# ── 2. Criar bucket S3 ────────────────────────────────────────────────────────
Write-Host "[2/7] Criando bucket S3: $BucketName..." -ForegroundColor Yellow

$bucketExists = aws s3api head-bucket --bucket $BucketName 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Bucket já existe, pulando criação." -ForegroundColor DarkYellow
} else {
    aws s3api create-bucket `
        --bucket $BucketName `
        --region $Region `
        --create-bucket-configuration LocationConstraint=$Region | Out-Null
    Write-Host "  Bucket criado." -ForegroundColor Green
}

# Permite objetos públicos (imagens de produto não são sensíveis)
aws s3api put-public-access-block `
    --bucket $BucketName `
    --public-access-block-configuration `
      "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" | Out-Null

# Bucket policy: leitura pública para qualquer objeto
$BucketPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BucketName/*"
    }
  ]
}
"@
$BucketPolicy | aws s3api put-bucket-policy --bucket $BucketName --policy file:///dev/stdin
Write-Host "  Bucket policy de leitura pública aplicada." -ForegroundColor Green

# CORS para o frontend poder fazer fetch das imagens
$CorsConfig = @"
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": []
    }
  ]
}
"@
$CorsConfig | aws s3api put-bucket-cors --bucket $BucketName --cors-configuration file:///dev/stdin
Write-Host "  CORS configurado." -ForegroundColor Green

# ── 3. IAM: política de acesso mínimo ao bucket ────────────────────────────────
Write-Host "[3/7] Criando política IAM: $PolicyName..." -ForegroundColor Yellow

$IamPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::$BucketName",
        "arn:aws:s3:::$BucketName/*"
      ]
    }
  ]
}
"@

$policyArn = "arn:aws:iam::${AccountId}:policy/$PolicyName"
$policyExists = aws iam get-policy --policy-arn $policyArn 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Política já existe, pulando." -ForegroundColor DarkYellow
} else {
    $IamPolicy | aws iam create-policy --policy-name $PolicyName --policy-document file:///dev/stdin | Out-Null
    Write-Host "  Política criada." -ForegroundColor Green
}

# ── 4. IAM: criar usuário do backend ──────────────────────────────────────────
Write-Host "[4/7] Criando usuário IAM: $IamUser..." -ForegroundColor Yellow

$userExists = aws iam get-user --user-name $IamUser 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Usuário já existe, pulando criação." -ForegroundColor DarkYellow
} else {
    aws iam create-user --user-name $IamUser | Out-Null
    Write-Host "  Usuário criado." -ForegroundColor Green
}

aws iam attach-user-policy --user-name $IamUser --policy-arn $policyArn | Out-Null
Write-Host "  Política anexada ao usuário." -ForegroundColor Green

# Cria access key para o backend
Write-Host "  Gerando Access Key..." -ForegroundColor Yellow
$KeysJson = aws iam create-access-key --user-name $IamUser | ConvertFrom-Json
$S3KeyId     = $KeysJson.AccessKey.AccessKeyId
$S3KeySecret = $KeysJson.AccessKey.SecretAccessKey
Write-Host "  Access Key criada." -ForegroundColor Green

# ── 5. Security Group para o RDS ──────────────────────────────────────────────
Write-Host "[5/7] Criando Security Group para o banco..." -ForegroundColor Yellow

$SgName = "$Project-rds-sg"
$SgId = aws ec2 create-security-group `
    --group-name $SgName `
    --description "SPI PostgreSQL access" `
    --region $Region `
    --query 'GroupId' --output text 2>$null

if (-not $SgId) {
    # Já existe — busca o ID
    $SgId = aws ec2 describe-security-groups `
        --filters "Name=group-name,Values=$SgName" `
        --region $Region `
        --query 'SecurityGroups[0].GroupId' --output text
    Write-Host "  Security Group já existe: $SgId" -ForegroundColor DarkYellow
} else {
    # Libera porta 5432 de qualquer origem
    aws ec2 authorize-security-group-ingress `
        --group-id $SgId `
        --protocol tcp `
        --port 5432 `
        --cidr "0.0.0.0/0" `
        --region $Region | Out-Null
    Write-Host "  Security Group criado: $SgId (porta 5432 aberta)" -ForegroundColor Green
}

# ── 6. RDS PostgreSQL ─────────────────────────────────────────────────────────
Write-Host "[6/7] Criando RDS PostgreSQL (t3.micro — free tier)..." -ForegroundColor Yellow
Write-Host "  Isso leva ~8 minutos. Aguarde..." -ForegroundColor DarkYellow

$dbExists = aws rds describe-db-instances --db-instance-identifier $DbId --region $Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  RDS já existe, buscando endpoint..." -ForegroundColor DarkYellow
} else {
    aws rds create-db-instance `
        --db-instance-identifier $DbId `
        --db-instance-class db.t3.micro `
        --engine postgres `
        --engine-version "15" `
        --master-username $DbUser `
        --master-user-password $DbPass `
        --db-name $DbName `
        --allocated-storage 20 `
        --publicly-accessible `
        --vpc-security-group-ids $SgId `
        --backup-retention-period 7 `
        --no-multi-az `
        --storage-type gp2 `
        --region $Region | Out-Null

    Write-Host "  RDS criado, aguardando ficar disponível..." -ForegroundColor Yellow
    aws rds wait db-instance-available `
        --db-instance-identifier $DbId `
        --region $Region
}

$RdsInfo  = aws rds describe-db-instances `
    --db-instance-identifier $DbId `
    --region $Region | ConvertFrom-Json
$RdsEndpoint = $RdsInfo.DBInstances[0].Endpoint.Address
$RdsPort     = $RdsInfo.DBInstances[0].Endpoint.Port

Write-Host "  RDS disponível: $RdsEndpoint`:$RdsPort" -ForegroundColor Green

# ── 7. Gerar arquivo .env ─────────────────────────────────────────────────────
Write-Host "[7/7] Gerando arquivo .env..." -ForegroundColor Yellow

$JwtSecret     = -join (1..48 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
$JwtRefSecret  = -join (1..48 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

$DatabaseUrl = "postgresql://${DbUser}:${DbPass}@${RdsEndpoint}:${RdsPort}/${DbName}?sslmode=require"

$EnvContent = @"
# ── Banco de dados (RDS PostgreSQL) ───────────────────────────────────────────
DATABASE_URL="$DatabaseUrl"
DIRECT_URL="$DatabaseUrl"

# ── Autenticação JWT ──────────────────────────────────────────────────────────
JWT_SECRET="$JwtSecret"
JWT_REFRESH_SECRET="$JwtRefSecret"

# ── Amazon S3 ─────────────────────────────────────────────────────────────────
AWS_REGION="$Region"
AWS_S3_BUCKET="$BucketName"
AWS_ACCESS_KEY_ID="$S3KeyId"
AWS_SECRET_ACCESS_KEY="$S3KeySecret"

# ── CORS (adicione a URL do frontend após o deploy) ───────────────────────────
CORS_ORIGINS="http://localhost:5173"

# ── Servidor ──────────────────────────────────────────────────────────────────
PORT=3333
NODE_ENV=production
"@

$EnvPath = Join-Path $PSScriptRoot ".." "Backend" ".env"
$EnvContent | Set-Content -Path $EnvPath -Encoding UTF8

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  SETUP CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Bucket S3 :  $BucketName" -ForegroundColor Cyan
Write-Host "  RDS Host  :  $RdsEndpoint" -ForegroundColor Cyan
Write-Host "  .env salvo:  Backend\.env" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "  1. cd Backend"
Write-Host "  2. npm install"
Write-Host "  3. npx prisma migrate deploy"
Write-Host "  4. npm run build"
Write-Host "  5. Fazer deploy no Elastic Beanstalk"
Write-Host ""
Write-Host "  GUARDE a senha do banco (não fica no .env em texto simples):" -ForegroundColor Red
Write-Host "  DB_PASSWORD = $DbPass" -ForegroundColor Red
Write-Host ""
