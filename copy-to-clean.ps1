$ErrorActionPreference = 'Stop'

$src = 'C:\Users\BROU WILLIAMS\Downloads\chrisroi-agence\chrisroi-agence'
$dst = 'C:\chrisroi-agence-build'

Write-Host "=== Nettoyage destination ==="
if (Test-Path $dst) {
    Remove-Item -Path $dst -Recurse -Force -ErrorAction Stop
}

Write-Host "=== Création destination ==="
New-Item -Path $dst -ItemType Directory -Force | Out-Null

$excludeNames = @(
    '.git', '.expo', 'node_modules', 'android', '.idea', 'dist',
    'C:dev', 'Cédev', 'cmdline-tools.zip', 'contrat_chrisroi_agence.docx',
    'logo.png', 'deployment', 'pb_data', 'pocketbase',
    'image_viewer.html', 'README.md.bak_web',
    'check_db.js', 'check_schema.js', 'create_admin.js',
    'fix_all.js', 'fix_final.js', 'fix_user.js', 'fix_v2.js', 'fix_v3.js',
    'set_name.js', 'setup_collection.js', 'index.js', 'index.ts',
    '*.log', '*.tmp', '*.db', '*.db-wal', '*.db-shm',
    '*.docx', '*.zip', '*.bak', '*.jpg', '*.png', '*.jpeg'
)

function ShouldExclude($name) {
    foreach ($pat in $excludeNames) {
        if ($pat -eq $name) { return $true }
        if ($pat -like '*.log' -and $name -like '*.log') { return $true }
        if ($pat -like '*.tmp' -and $name -like '*.tmp') { return $true }
        if ($pat -like '*.db*' -and $name -like '*.db*') { return $true }
        if ($pat -like '*.docx' -and $name -like '*.docx') { return $true }
        if ($pat -like '*.zip' -and $name -like '*.zip') { return $true }
        if ($pat -like '*.bak' -and $name -like '*.bak') { return $true }
        if ($pat -like '*.jpg' -and $name -like '*.jpg') { return $true }
        if ($pat -like '*.png' -and $name -like '*.png') { return $true }
        if ($pat -like '*.jpeg' -and $name -like '*.jpeg') { return $true }
        if ($name -match '^(check_|fix_|create_|set_|setup_)|index\.(js|ts)$') { return $true }
    }
    return $false
}

function Copy-Dir($s, $d) {
    New-Item -Path $d -ItemType Directory -Force | Out-Null
    $items = Get-ChildItem -Path $s -Force
    foreach ($item in $items) {
        if (ShouldExclude $item.Name) {
            Write-Host "  skip: $($item.Name)"
            continue
        }
        $si = Join-Path $s $item.Name
        $di = Join-Path $d $item.Name
        if ($item.PSIsContainer) {
            Copy-Dir $si $di
        } else {
            Copy-Item -Path $si -Destination $di -Force
        }
    }
}

Write-Host "=== Copie de $src vers $dst ==="
Copy-Dir $src $dst

Write-Host "`n=== Contenu destination ==="
Get-ChildItem -Path $dst | Select-Object Name | Format-Table -AutoSize

function Get-DirSize($dir) {
    $total = 0
    $items = Get-ChildItem -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        if ($item.PSIsContainer) { continue }
        try { $total += $item.Length } catch {}
    }
    return $total
}
$size = Get-DirSize $dst
if ($size -gt 1MB) { Write-Host "`n=== Taille: $([math]::Round($size/1MB,1)) MB ===" }
else { Write-Host "`n=== Taille: $([math]::Round($size/1KB,1)) KB ===" }
