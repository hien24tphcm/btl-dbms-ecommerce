<#
.SYNOPSIS
    Exports the standalone MS SQL Server 2022 Docker image and generates a team-leader handoff bundle.
.DESCRIPTION
    Builds (if needed) ecommerce_mssql:2022, exports it to dist/dbms-mssql-image.tar via `docker save`,
    and copies docker-compose.handoff.yml + .env.example into handoff/ for final multi-container integration.
#>

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DistDir = Join-Path $RepoRoot "dist"
$HandoffDir = Join-Path $RepoRoot "handoff"
$TarPath = Join-Path $DistDir "dbms-mssql-image.tar"
$ImageName = "ecommerce_mssql:2022"

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
New-Item -ItemType Directory -Force -Path $HandoffDir | Out-Null

Write-Host "[1/3] Building $ImageName..." -ForegroundColor Cyan
docker compose -f (Join-Path $RepoRoot "docker-compose.yml") build mssql
if ($LASTEXITCODE -ne 0) { throw "Docker build failed." }

Write-Host "[2/3] Exporting image to $TarPath..." -ForegroundColor Cyan
docker save -o $TarPath $ImageName
if ($LASTEXITCODE -ne 0) { throw "Docker save failed." }

Write-Host "[3/3] Generating handoff bundle in $HandoffDir..." -ForegroundColor Cyan
Copy-Item (Join-Path $RepoRoot ".env.example") (Join-Path $HandoffDir ".env.example") -Force
Copy-Item (Join-Path $RepoRoot "docker-compose.yml") (Join-Path $HandoffDir "docker-compose.handoff.yml") -Force

$SizeMB = [math]::Round((Get-Item $TarPath).Length / 1MB, 2)
Write-Host "Export complete: $TarPath ($SizeMB MB)" -ForegroundColor Green
Write-Host "Team leader import command: docker load -i dbms-mssql-image.tar" -ForegroundColor Yellow
