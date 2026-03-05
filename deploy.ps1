# Deploy build to installed Apollo location
$ErrorActionPreference = 'Stop'

$installDir = 'C:\Program Files\Apollo'
$buildDir   = 'C:\Vibepollo\build'

# Step 6a: Backup installed exe
Copy-Item "$installDir\sunshine.exe" "$installDir\sunshine.exe.bak" -Force
Write-Host "Backup: sunshine.exe.bak created"

# Step 6b: Copy new exe
Copy-Item "$buildDir\sunshine.exe" "$installDir\sunshine.exe" -Force
Write-Host "Deployed: sunshine.exe ($(( Get-Item "$buildDir\sunshine.exe" ).LastWriteTime))"

# Step 6c: Deploy drivers\vbcable\install.ps1 and bundled installer
New-Item -ItemType Directory -Path "$installDir\drivers\vbcable" -Force | Out-Null
Copy-Item "$buildDir\drivers\vbcable\install.ps1"           "$installDir\drivers\vbcable\install.ps1"           -Force
Copy-Item "$buildDir\drivers\vbcable\VBCABLE_Setup_x64.exe" "$installDir\drivers\vbcable\VBCABLE_Setup_x64.exe" -Force
Write-Host "Deployed: drivers\vbcable\install.ps1 + VBCABLE_Setup_x64.exe"

# Step 6d: Deploy updated web assets
$buildWeb   = "$buildDir\assets\web"
$installWeb = "$installDir\assets\web"
if (Test-Path $buildWeb) {
    Copy-Item $buildWeb $installWeb -Recurse -Force
    Write-Host "Deployed: assets\web"
} else {
    Write-Host "No assets\web in build dir -- skipping"
}

# Step 7: Restart service
Write-Host "Starting ApolloService..."
Start-Service ApolloService
$svc = Get-Service ApolloService
Write-Host "Service status: $($svc.Status)"
