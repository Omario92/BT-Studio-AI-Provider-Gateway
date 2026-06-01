# BT-Studio AI Provider Gateway - Initial Push Script
# Chay tu thu muc goc: F:\App\BT-Studio-AI-Provider-Gateway

$ErrorActionPreference = "Stop"

$RepoUrl  = "https://github.com/Omario92/BT-Studio-AI-Provider-Gateway.git"
$Branch   = "main"
$Message  = "chore: initial commit - BT Studio AI Provider Gateway"

Write-Host "==> Kiem tra git..." -ForegroundColor Cyan
git --version

if (-not (Test-Path ".git")) {
    Write-Host "==> Khoi tao git repo..." -ForegroundColor Cyan
    git init
    git branch -M $Branch
}

Write-Host "==> Cau hinh remote..." -ForegroundColor Cyan
$remoteExists = git remote | Select-String -Pattern "^origin$"
if ($remoteExists) {
    git remote set-url origin $RepoUrl
} else {
    git remote add origin $RepoUrl
}

Write-Host "==> Stage cac file..." -ForegroundColor Cyan
git add -A

Write-Host "==> Trang thai:" -ForegroundColor Cyan
git status --short

Write-Host "==> Commit..." -ForegroundColor Cyan
git commit -m $Message

Write-Host "==> Push len GitHub ($Branch)..." -ForegroundColor Cyan
git push -u origin $Branch

Write-Host ""
Write-Host "Done. Repo da push len: $RepoUrl" -ForegroundColor Green
