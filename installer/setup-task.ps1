param([string]$AppPath)
# Creates the Vibepollo Task Scheduler autostart task with a 30-second delay.
# The delay is critical: WASAPI and Steam audio drivers need time to initialize
# after login. Without it, Vibepollo intermittently fails to find Steam Streaming
# Microphone on first login after a cold boot.

$taskName = 'Vibepollo'
$exePath  = Join-Path $AppPath 'sunshine.exe'

# Remove any existing task (upgrade scenario)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action   = New-ScheduledTaskAction -Execute $exePath -WorkingDirectory $AppPath
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = 'PT30S'

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -MultipleInstances IgnoreNew

# Allow running on battery (set via XML since PS cmdlet lacks the flag)
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries     = $false

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName  $taskName `
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -Principal $principal `
    -ErrorAction Stop | Out-Null

Write-Host "Task Scheduler: Vibepollo autostart registered (30s delay, HIGHEST privilege)"
