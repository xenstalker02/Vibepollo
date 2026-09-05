# Offline mocks only. No NetSecurity module is imported or invoked.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../installer/configure-firewall.ps1" -Program 'C:\Fixture\sunshine.exe'
function Test-Path { param($LiteralPath,$PathType) return $true }
function Get-NetFirewallRule {
    [CmdletBinding()] param($PolicyStore,$Name)
    if ($Name) { return @($script:rules | Where-Object Name -eq $Name) }
    return @($script:rules)
}
function Get-NetFirewallApplicationFilter {
    [CmdletBinding()] param($AssociatedNetFirewallRule)
    $filter = [pscustomobject]@{Program=$AssociatedNetFirewallRule.Program}
    if ($AssociatedNetFirewallRule.PSObject.Properties['Package']) {
        $filter | Add-Member -NotePropertyName Package -NotePropertyValue $AssociatedNetFirewallRule.Package
    }
    return $filter
}
function Get-NetFirewallPortFilter { [CmdletBinding()] param($AssociatedNetFirewallRule) return [pscustomobject]@{Protocol=$AssociatedNetFirewallRule.Protocol;LocalPort=$AssociatedNetFirewallRule.Ports;RemotePort='Any'} }
function Get-NetFirewallAddressFilter { [CmdletBinding()] param($AssociatedNetFirewallRule) return [pscustomobject]@{LocalAddress='Any';RemoteAddress=$AssociatedNetFirewallRule.Remote} }
function Get-NetFirewallServiceFilter { [CmdletBinding()] param($AssociatedNetFirewallRule) return [pscustomobject]@{Service='Any'} }
function Get-NetFirewallInterfaceFilter { [CmdletBinding()] param($AssociatedNetFirewallRule) return [pscustomobject]@{InterfaceAlias='Any'} }
function Get-NetFirewallInterfaceTypeFilter { [CmdletBinding()] param($AssociatedNetFirewallRule) return [pscustomobject]@{InterfaceType='Any'} }
function Get-NetFirewallSecurityFilter {
    [CmdletBinding()] param($AssociatedNetFirewallRule)
    return [pscustomobject]@{Authentication=$AssociatedNetFirewallRule.Authentication;Encryption=$AssociatedNetFirewallRule.Encryption;OverrideBlockRules=$AssociatedNetFirewallRule.OverrideBlockRules;LocalUser=$AssociatedNetFirewallRule.LocalUser;RemoteUser=$AssociatedNetFirewallRule.RemoteUser;RemoteMachine=$AssociatedNetFirewallRule.RemoteMachine}
}
function Set-DefaultMockSecurity($rule) {
    foreach ($entry in @{Package='Any';EdgeTraversalPolicy='Block';Authentication='NotRequired';Encryption='NotRequired';OverrideBlockRules='False';LocalUser='Any';RemoteUser='Any';RemoteMachine='Any'}.GetEnumerator()) {
        $rule | Add-Member -NotePropertyName $entry.Key -NotePropertyValue $entry.Value -Force
    }
}
function New-NetFirewallRule {
    [CmdletBinding()] param($PolicyStore,$Name,$DisplayName,$Group,$Program,$Direction,$Action,$Enabled,$Profile,$Protocol,$LocalPort)
    $script:events.Add('add:'+$Protocol) | Out-Null
    $rule = [pscustomobject]@{Name=$Name;DisplayName=$DisplayName;Group=$Group;Program=$Program;Direction=$Direction;Action=$Action;Enabled=$Enabled;Profile=$Profile;Protocol=$Protocol;Ports=$LocalPort;Remote='Any'}
    Set-DefaultMockSecurity $rule
    $script:rules.Add($rule) | Out-Null
    if ($script:failProtocol -eq $Protocol) { throw 'Mock partial creation failure' }
    return $rule
}
function Remove-NetFirewallRule {
    [CmdletBinding()] param([Parameter(ValueFromPipeline=$true)]$InputObject)
    process {
        if ($InputObject) {
            $script:events.Add('remove:'+$InputObject.Name) | Out-Null
            if ($script:failRemoval -eq $InputObject.Name) { throw 'Mock removal failure' }
            $script:rules.Remove($InputObject)
        }
    }
}
function Reset-Fixture {
    param([switch]$WithoutCustom)
    $script:rules = New-Object System.Collections.ArrayList
    $script:events = New-Object System.Collections.ArrayList
    $script:failProtocol = ''; $script:failRemoval = ''
    foreach ($id in 'old1','old2','custom') {
        if ($WithoutCustom -and $id -eq 'custom') { continue }
        $rule = [pscustomobject]@{Name=$id;DisplayName='Vibepollo TCP';Group='';Program='Any';Direction='Inbound';Action='Allow';Enabled='True';Profile='Any';Protocol='TCP';Ports=@('47984','47989','47990');Remote=$(if($id -eq 'custom'){'LocalSubnet'}else{'Any'})}
        Set-DefaultMockSecurity $rule
        $script:rules.Add($rule) | Out-Null
    }
}
function Assert-True($condition,$message) { if (-not $condition) { throw $message } }
$program = 'C:\Fixture\sunshine.exe'
Reset-Fixture -WithoutCustom
Invoke-VibepolloFirewall -Program $program
Assert-True ($script:events[0] -eq 'add:TCP' -and $script:events[1] -eq 'add:UDP') 'Both replacements must precede removal'
Assert-True ($script:rules.Count -eq 2) 'Only the two managed replacements should remain'
Invoke-VibepolloFirewall -Program $program
Assert-True ($script:rules.Count -eq 2) 'Repeat migration must not accumulate rules'
Assert-True (@($script:rules | Where-Object { $_.Protocol -eq 'TCP' -and $_.Program -eq $program -and $_.Ports -contains '48010' }).Count -eq 1) 'RTSP executable-scoped rule missing'
Write-Output 'PASS success ordering, repeated installation, RTSP port'
Reset-Fixture -WithoutCustom
$script:failProtocol = 'UDP'
$failed = $false
try { Invoke-VibepolloFirewall -Program $program } catch { $failed = $true }
Assert-True $failed 'Creation error must surface'
Assert-True ($script:rules.Count -eq 2 -and @($script:rules | Where-Object Name -like 'Vibepollo.Managed.*').Count -eq 0) 'Partial create must roll back new rules only'
Write-Output 'PASS partial creation rollback preserves original rules'
Reset-Fixture -WithoutCustom
$script:failRemoval = 'old1'; $failed = $false
try { Invoke-VibepolloFirewall -Program $program } catch { $failed = $true }
Assert-True $failed 'Removal error must surface'
Assert-True (@($script:rules | Where-Object Name -like 'Vibepollo.Managed.*').Count -eq 2) 'Cleanup failure must retain working replacements'
Write-Output 'PASS cleanup failure preserves replacement ingress'
Reset-Fixture
Invoke-VibepolloFirewall -Program $program -Mode Remove
Assert-True ($script:rules.Count -eq 1 -and $script:rules[0].Name -eq 'custom') 'Uninstall must preserve custom rules'
Write-Output 'PASS scoped uninstall'

function Assert-InstallRefusedWithoutMutation($message) {
    $before = ConvertTo-Json -InputObject @($script:rules) -Depth 5 -Compress
    $failed = $false
    try { Invoke-VibepolloFirewall -Program $program } catch { $failed = $true }
    Assert-True $failed $message
    Assert-True ($script:events.Count -eq 0) 'Conflict must be detected before any add/remove attempt'
    Assert-True ((ConvertTo-Json -InputObject @($script:rules) -Depth 5 -Compress) -eq $before) 'All original rule properties must remain unchanged'
}
Reset-Fixture
Assert-InstallRefusedWithoutMutation 'Mixed legacy/custom rules must block unrestricted replacement ingress'
Reset-Fixture
$script:rules.RemoveAt(0)
$script:rules.RemoveAt(0)
Assert-True ($script:rules.Count -eq 1 -and $script:rules[0].Name -eq 'custom') 'Custom-only fixture required'
Assert-InstallRefusedWithoutMutation 'Custom-only rules must block unrestricted replacement ingress'
Write-Output 'PASS mixed and custom-only policy conflicts stop before any mutation'

foreach ($packageDefault in @($null, '')) {
    Reset-Fixture -WithoutCustom
    $script:rules[0].Package = $packageDefault
    Invoke-VibepolloFirewall -Program $program
    Assert-True ($script:rules.Count -eq 2 -and @($script:rules | Where-Object Name -like 'Vibepollo.Managed.*').Count -eq 2) 'Explicit null/empty package is an unrestricted legacy default'
}
Reset-Fixture -WithoutCustom
$script:rules[0].PSObject.Properties.Remove('Package')
Assert-InstallRefusedWithoutMutation 'Missing Package property must remain unfamiliar and block install'
Write-Output 'PASS explicit null/empty package defaults accepted; absent Package property refused'

foreach ($entry in @{Package='SYNTHETIC-PACKAGE';EdgeTraversalPolicy='Allow';Authentication='Required';Encryption='Required';OverrideBlockRules='True';LocalUser='SYNTHETIC-LOCAL-USER';RemoteUser='SYNTHETIC-REMOTE-USER';RemoteMachine='SYNTHETIC-REMOTE-MACHINE'}.GetEnumerator()) {
    Reset-Fixture -WithoutCustom
    $script:rules[0].($entry.Key) = $entry.Value
    Assert-InstallRefusedWithoutMutation ('Install must preserve effective custom ' + $entry.Key + ' policy')
    Reset-Fixture
    $script:rules[0].($entry.Key) = $entry.Value
    Invoke-VibepolloFirewall -Program $program -Mode Remove
    Assert-True (@($script:rules | Where-Object Name -eq 'old1').Count -eq 1) ('Preserve customized ' + $entry.Key)
    Assert-True (@($script:rules | Where-Object Name -eq 'old2').Count -eq 0) 'Recognized legacy rule should still be removed'
}
Write-Output 'PASS custom package, edge traversal, authentication, encryption and principal restrictions preserved'

# Static installer wiring regression: Inno swallows BeforeInstall exceptions.
# Every service mutation/start and optional UI launch must use the Boolean gate.
# This checks source wiring only; it does not execute Setup or prove runtime UI.
$installer = Get-Content -LiteralPath "$PSScriptRoot/../installer/vibepollo.iss" -Raw
$runSection = [regex]::Match($installer, '(?s)\[Run\](.*?)\[UninstallRun\]').Groups[1].Value
$gatedEntries = @($runSection -split "`n" | Where-Object { $_ -match 'Parameters: "(?:create|config|failure|failureflag|start) VibepollService\b' -or $_ -match '^Filename: "https://localhost:47990"' })
Assert-True ($gatedEntries.Count -eq 6) 'Expected five service entries and one UI entry'
foreach ($entry in $gatedEntries) {
    Assert-True ($entry -match '; Check: EnsureVibepolloFirewall\s*$') 'All service/UI entries require the firewall success gate'
    Assert-True ($entry -notmatch 'BeforeInstall:') 'Do not rely on swallowed BeforeInstall exceptions'
}
$firewallCode = [regex]::Match($installer, '(?s)function EnsureVibepolloFirewall\(\): Boolean;(.*?)function GetCustomSetupExitCode').Groups[1].Value
Assert-True ($firewallCode -match 'if not FirewallAttempted then') 'The gate must cache the first attempt'
Assert-True ($firewallCode -match 'FirewallConfigured := FirewallConfigured and \(ResultCode = 0\)') 'Gate requires process launch and zero exit status'
Assert-True ($firewallCode -match 'Result := FirewallConfigured;' -and $firewallCode -notmatch 'RaiseException') 'Return explicit readiness, not an exception'
Assert-True ($installer -match 'if FirewallAttempted and not FirewallConfigured then\s+Result := 1;') 'Firewall failure must produce nonzero Setup exit status'
Write-Output 'PASS static installer gate coverage and nonzero failure exit wiring (Setup runtime not executed)'
