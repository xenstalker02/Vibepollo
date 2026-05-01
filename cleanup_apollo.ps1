# cleanup_apollo.ps1
# Removes the Apollo installation directory from Program Files.
# This is a destructive, irreversible operation — requires explicit confirmation.

$target = 'C:\Program Files\Apollo'

if (-not (Test-Path $target)) {
    Write-Output "Nothing to remove: '$target' does not exist."
    exit 0
}

Write-Warning "This will permanently delete: $target"
Write-Warning "This action is IRREVERSIBLE. All files in that directory will be lost."
$confirm = Read-Host "Type 'YES' to confirm deletion, or anything else to abort"

if ($confirm -ne 'YES') {
    Write-Output "Aborted — no files were deleted."
    exit 1
}

Remove-Item $target -Recurse -Force
if (Test-Path $target) {
    Write-Output 'STILL EXISTS — removal may have failed for some files.'
} else {
    Write-Output 'Removed successfully.'
}
