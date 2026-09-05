#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Program,
    [ValidateSet('Install', 'Remove')][string]$Mode = 'Install'
)

function Invoke-VibepolloFirewall {
    [CmdletBinding()]
    param([string]$Program, [ValidateSet('Install', 'Remove')][string]$Mode = 'Install')
    $ErrorActionPreference = 'Stop'
    $programPath = [IO.Path]::GetFullPath($Program)
    if ([IO.Path]::GetFileName($programPath) -ne 'sunshine.exe') {
        throw 'Expected the installed sunshine.exe path.'
    }
    if ($Mode -eq 'Install' -and -not (Test-Path -LiteralPath $programPath -PathType Leaf)) {
        throw 'Installed sunshine.exe is missing; existing firewall rules were preserved.'
    }
    $group = 'Vibepollo installer managed v1'
    $specs = @(
        @{ Protocol = 'TCP'; Ports = @('47984', '47989', '47990', '48010'); Legacy = '47984,47989,47990' },
        @{ Protocol = 'UDP'; Ports = @('47998-48010'); Legacy = '47998-48010' }
    )
    # Only exact known installer shapes qualify. A user's same-named custom rule
    # with different scope, ports, executable, or action is never removed.
    $oldRules = @()
    $sameNameCount = 0
    foreach ($rule in @(Get-NetFirewallRule -PolicyStore PersistentStore -ErrorAction Stop)) {
        foreach ($spec in $specs) {
            if ($rule.DisplayName -ne ('Vibepollo ' + $spec.Protocol)) { continue }
            $sameNameCount++
            if ([string]$rule.Direction -ne 'Inbound' -or [string]$rule.Action -ne 'Allow' -or
                [string]$rule.Profile -notin @('Any', '0') -or [string]$rule.Enabled -ne 'True' -or
                [string]$rule.EdgeTraversalPolicy -ne 'Block') { continue }
            $app = Get-NetFirewallApplicationFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            $port = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            $address = Get-NetFirewallAddressFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            $service = Get-NetFirewallServiceFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            $interface = Get-NetFirewallInterfaceFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            $interfaceType = Get-NetFirewallInterfaceTypeFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            $security = Get-NetFirewallSecurityFilter -AssociatedNetFirewallRule $rule -ErrorAction Stop
            if (@($app).Count -ne 1 -or @($port).Count -ne 1 -or @($address).Count -ne 1 -or
                @($service).Count -ne 1 -or @($interface).Count -ne 1 -or
                @($interfaceType).Count -ne 1 -or @($security).Count -ne 1) { continue }
            # Authentication, principal and package restrictions also establish
            # custom ownership. Missing/unfamiliar values are preserved.
            $packageProperty = $app.PSObject.Properties['Package']
            $defaultPackage = $null -ne $packageProperty -and
                ([string]::IsNullOrEmpty([string]$packageProperty.Value) -or [string]$packageProperty.Value -eq 'Any')
            if (-not $defaultPackage -or
                [string]$security.Authentication -ne 'NotRequired' -or
                [string]$security.Encryption -ne 'NotRequired' -or
                [string]$security.OverrideBlockRules -ne 'False' -or
                [string]$security.LocalUser -ne 'Any' -or
                [string]$security.RemoteUser -ne 'Any' -or
                [string]$security.RemoteMachine -ne 'Any') { continue }
            $protocolNumber = if ($spec.Protocol -eq 'TCP') { '6' } else { '17' }
            if ([string]$port.Protocol -notin @($spec.Protocol, $protocolNumber) -or
                (@($port.RemotePort) -join ',') -ne 'Any' -or
                (@($address.LocalAddress) -join ',') -ne 'Any' -or
                (@($address.RemoteAddress) -join ',') -ne 'Any' -or [string]$service.Service -ne 'Any' -or
                (@($interface.InterfaceAlias) -join ',') -ne 'Any' -or [string]$interfaceType.InterfaceType -ne 'Any') { continue }
            $ports = @($port.LocalPort | Sort-Object) -join ','
            $expected = @($spec.Ports | Sort-Object) -join ','
            $owned = $rule.Group -eq $group -and $rule.Name -like 'Vibepollo.Managed.*' -and
                     $app.Program -eq $programPath -and $ports -eq $expected
            $legacy = [string]::IsNullOrEmpty([string]$rule.Group) -and
                      [string]::IsNullOrEmpty([string]$rule.Description) -and
                      $app.Program -in @('Any', $programPath) -and $ports -in @($spec.Legacy, $expected)
            if ($owned -or $legacy) { $oldRules += $rule }
        }
    }
    if ($Mode -eq 'Install') {
        # Preserving a restrictive rule object is insufficient: a parallel broad
        # allow rule would bypass its policy. Stop before any mutation whenever
        # a same-name rule cannot be proven to match an installer-owned shape.
        if ($sameNameCount -ne $oldRules.Count) {
            throw 'Custom or unfamiliar Vibepollo firewall rules require manual policy review. No firewall rules were changed.'
        }
        $stagedNames = @()
        try {
            foreach ($spec in $specs) {
                $name = 'Vibepollo.Managed.' + $spec.Protocol + '.' + [guid]::NewGuid().ToString('N')
                # Record before attempting: a provider may create a rule then fail.
                $stagedNames += $name
                $null = New-NetFirewallRule -PolicyStore PersistentStore -Name $name -DisplayName ('Vibepollo ' + $spec.Protocol) `
                    -Group $group -Program $programPath -Direction Inbound -Action Allow -Enabled True -Profile Any `
                    -Protocol $spec.Protocol -LocalPort $spec.Ports -ErrorAction Stop
            }
        } catch {
            $creationError = $_
            foreach ($name in $stagedNames) {
                try {
                    Get-NetFirewallRule -PolicyStore PersistentStore -Name $name -ErrorAction SilentlyContinue |
                        Remove-NetFirewallRule -ErrorAction Stop
                } catch { Write-Warning ('Could not remove staged firewall rule ' + $name) }
            }
            throw $creationError
        }
    }
    # Both new rules now exist. Cleanup failures keep their replacement ingress
    # alive and surface failure for operator review rather than rolling it back.
    foreach ($rule in $oldRules) {
        Remove-NetFirewallRule -InputObject $rule -ErrorAction Stop
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        Invoke-VibepolloFirewall -Program $Program -Mode $Mode
    } catch {
        Write-Error -ErrorRecord $_ -ErrorAction Continue
        exit 1
    }
}
