$ErrorActionPreference = 'Stop'

Write-Host "=== 1. Restaurer le depot GitHub (a868f52) ==="
$orig = 'C:\Users\BROU WILLIAMS\Downloads\chrisroi-agence\chrisroi-agence'
Push-Location $orig
git push --force origin a868f520bd499ad86cf6d251ea4178677113d637 2>&1
$head = git rev-parse HEAD
Write-Host "HEAD original = $head"
Pop-Location

Write-Host ""
Write-Host "=== 2. Supprimer ancien clone si present ==="
$clone = 'C:\chrisroi-clone'
if (Test-Path $clone) {
    Remove-Item -Path $clone -Recurse -Force
    Write-Host "Supprime $clone"
}

Write-Host ""
Write-Host "=== 3. Cloner depuis GitHub (sans espace) ==="
git clone https://github.com/n0vitch0k/chrisroi-agence.git $clone 2>&1
Push-Location $clone
Write-Host "Clone HEAD = $(git rev-parse HEAD)"
Pop-Location

Write-Host ""
Write-Host "=== 4. EAS build depuis le clone GitHub ==="
Push-Location $clone
npx eas build -p android --profile production --no-wait 2>&1
Pop-Location
