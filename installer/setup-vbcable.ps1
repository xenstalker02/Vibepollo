#Requires -Version 5.0
# setup-vbcable.ps1 — Silently install VB-Audio CABLE if not already present.
# Called by the Vibepollo installer via [Run]. Exit 0 always (best-effort, non-blocking).

param(
    [string]$AppPath = $PSScriptRoot
)

$logTag = "[vbcable-setup]"

function Write-Log {
    param([string]$msg)
    $ts = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    Write-Output "$ts $logTag $msg"
}

# Check whether CABLE Input is already present as a Windows audio device.
$cablePresent = Get-WmiObject Win32_SoundDevice -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*CABLE*" -or $_.Description -like "*VB-Audio*" }

if ($cablePresent) {
    Write-Log "VB-Audio CABLE already installed — skipping"
    exit 0
}

$setupExe = Join-Path $AppPath "drivers\vbcable\VBCABLE_Setup_x64.exe"

if (-not (Test-Path $setupExe)) {
    Write-Log "VB-Cable installer not found at: $setupExe — skipping"
    exit 0
}

Write-Log "CABLE Input not detected — running VB-Cable installer: $setupExe"

try {
    $proc = Start-Process -FilePath $setupExe -ArgumentList "/S" -Wait -PassThru -ErrorAction Stop
    if ($proc.ExitCode -eq 0) {
        Write-Log "VB-Cable installer completed successfully (exit 0)"
    } else {
        Write-Log "VB-Cable installer exited with code $($proc.ExitCode) — may require reboot or manual install"
    }
} catch {
    Write-Log "VB-Cable installer failed: $_"
}

exit 0
