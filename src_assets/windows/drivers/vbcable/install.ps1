# VB-Audio CABLE silent installer
# Downloads and silently installs VB-Audio Virtual Cable (VB-CABLE)
# https://vb-audio.com/Cable/
#
# This script is run automatically by Vibepollo when mic passthrough is
# configured and VB-Audio CABLE is not already installed.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$downloadUrl = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip'
$zipName = 'VBCABLE_Driver_Pack43.zip'
$tempDir = Join-Path $env:TEMP "vbcable_install_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"

try {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    Write-Output "Downloading VB-Audio CABLE from $downloadUrl ..."
    $zipPath = Join-Path $tempDir $zipName
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

    Write-Output "Extracting..."
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

    $installer = Get-ChildItem -Path $tempDir -Filter 'VBCABLE_Setup*.exe' -Recurse | Select-Object -First 1
    if (-not $installer) {
        $installer = Get-ChildItem -Path $tempDir -Filter 'VBCABLE_Setup_x64.exe' -Recurse | Select-Object -First 1
    }
    if (-not $installer) {
        throw "Could not find VBCABLE_Setup*.exe in the downloaded archive."
    }

    Write-Output "Running installer: $($installer.FullName)"
    $proc = Start-Process -FilePath $installer.FullName -ArgumentList '/S', '/qn' -Wait -PassThru
    if ($proc.ExitCode -notin @(0, 3010)) {
        throw "Installer exited with code $($proc.ExitCode)"
    }

    Write-Output "VB-Audio CABLE installed successfully (exit code $($proc.ExitCode))."
    exit 0
}
catch {
    Write-Warning "VB-Audio CABLE installation failed: $_"
    exit 1
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    }
}
