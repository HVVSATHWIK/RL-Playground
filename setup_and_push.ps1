# Automated Setup, Build & Git Push Script for nn-playground
$TargetParent = "C:\Users\Veerendranath\OneDrive\Documents\SEMESTER-7\Reinforcement Learning\Project"
$RepoDir = Join-Path $TargetParent "nn-playground"
$RepoUrl = "https://github.com/HVVSATHWIK/nn-playground.git"

Write-Host "=== 1. Ensuring Project Directory Exists ===" -ForegroundColor Cyan
if (-not (Test-Path $TargetParent)) {
    New-Item -ItemType Directory -Force -Path $TargetParent | Out-Null
}

if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
    Write-Host "Cloning $RepoUrl into $RepoDir..." -ForegroundColor Cyan
    Set-Location $TargetParent
    git clone $RepoUrl
}

Write-Host "=== 2. Copying Updated Robo-Dojo 3D Physics & RL Files ===" -ForegroundColor Cyan
$ScriptSource = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($ScriptSource -ne $RepoDir) {
    Copy-Item -Path (Join-Path $ScriptSource "*") -Destination $RepoDir -Recurse -Force -Exclude ".git"
}

Set-Location $RepoDir
Write-Host "=== 3. Installing Dependencies & Running Tests ===" -ForegroundColor Cyan
npm install
npm test
npm run build

Write-Host "=== 4. Committing & Pushing to GitHub ===" -ForegroundColor Cyan
git add .
git commit -m "feat(robo-dojo): upgrade 3D robot physics, stamina guard mechanics, and RL studio UI"
git push origin main

Write-Host "=== Done! Successfully pushed updates to $RepoUrl ===" -ForegroundColor Green
