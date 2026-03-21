param([string]$AppPath)
# Installs the Steam Streaming Microphone virtual audio driver.
# Only runs if Steam is installed. Safe to run multiple times (pnputil is idempotent).

$infPath = Join-Path $AppPath "drivers\SteamStreamingMicrophone\SteamStreamingMicrophone.inf"

if (-not (Test-Path $infPath)) {
    Write-Host "Steam Streaming Microphone INF not found at: $infPath — skipping driver install"
    exit 0
}

# Check if Steam is installed
$steamPaths = @(
    "$env:ProgramFiles(x86)\Steam\Steam.exe",
    "$env:ProgramFiles\Steam\Steam.exe",
    (Get-ItemProperty -Path 'HKCU:\Software\Valve\Steam' -Name 'SteamExe' -ErrorAction SilentlyContinue)?.SteamExe
) | Where-Object { $_ -and (Test-Path $_) }

if ($steamPaths.Count -eq 0) {
    Write-Host "Steam not detected — skipping Steam Streaming Microphone driver install"
    exit 0
}

Write-Host "Steam detected. Installing Steam Streaming Microphone driver..."

try {
    $result = & pnputil /add-driver "$infPath" /install 2>&1
    Write-Host $result
    Write-Host "Steam Streaming Microphone driver installed successfully."
} catch {
    Write-Warning "Driver install failed: $_"
    exit 1
}
