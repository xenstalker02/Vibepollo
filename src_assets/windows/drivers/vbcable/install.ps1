# VB-Audio CABLE silent installer
# Runs the bundled VBCABLE_Setup_x64.exe silently.
# Elevation is provided by the Vibepollo C++ layer (CreateProcessAsUserW with admin token).
#
# This script is run automatically by Vibepollo when mic passthrough is
# configured and VB-Audio CABLE is not already installed.
$ErrorActionPreference = 'Stop'

$installer = Join-Path $PSScriptRoot 'VBCABLE_Setup_x64.exe'
if (-not (Test-Path $installer)) {
    throw "VBCABLE_Setup_x64.exe not found at $installer"
}

Write-Output "Running installer: $installer"
$proc = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru
if ($proc.ExitCode -notin @(0, 3010)) {
    throw "Installer exited with code $($proc.ExitCode)"
}

Write-Output "VB-Audio CABLE installed successfully (exit code $($proc.ExitCode))."
exit 0
