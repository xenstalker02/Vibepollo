# Vibepollo Quick Reference
Last updated: 2026-04-01

## Current State
| Item | Value |
|------|-------|
| Vibepollo HEAD | `3d0a25bf` — fix(tray): show idle state for Desktop/placebo on client disconnect |
| Vibelight HEAD | `22b7a694` — fix(ui): revert setApplicationName to Moonlight |
| Upstream base | Nonary 1.15.0-stable.2 |
| Mic architecture | Steam Streaming Mic PRIMARY, VB-Cable FALLBACK |
| Bitrate | 64kbps Opus mono |
| Jitter buffer | 2 packets = 40ms |
| WASAPI prebuffer | 2 packets = 40ms |

## Autostart
Task Scheduler: Task name "Vibepollo", ONLOGON, 30s delay, HIGHEST privilege.
Binary: `C:\Vibepollo\build\sunshine.exe`

## Kill sunshine before building
```powershell
Stop-Service -Name ApolloService -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Get-Process -Name sunshine -ErrorAction SilentlyContinue | ForEach-Object { taskkill /PID $_.Id /F /T 2>&1 | Out-Null }
Start-Sleep 2
if (Get-Process -Name sunshine -EA SilentlyContinue) { Write-Host 'STILL_RUNNING — rename sunshine.exe to .old' } else { Write-Host 'CLEARED' }
```

Note: The Windows service registered by sunshinesvc.exe is named **ApolloService**,
not "sunshinesvc". Use `Stop-Service ApolloService` to stop it via SCM.
For the Task Scheduler autostart (not the service), Stop-Process or taskkill is correct.

## Build
```bash
export PATH="/c/Windows/System32/downlevel:/c/msys64/ucrt64/bin:/c/msys64/usr/bin:$PATH"
export TEMP="C:\\Users\\me\\AppData\\Local\\Temp"
export TMP="C:\\Users\\me\\AppData\\Local\\Temp"
cd /c/Vibepollo/build && ninja sunshine 2>&1 | tail -15
echo "Binary: $(ls -lh sunshine.exe)"
```

## Claude Code
```bash
cd C:\Vibepollo && claude --dangerously-skip-permissions
```

## Key Facts
- Windows service name: ApolloService (registered by sunshinesvc.exe)
- sunshine_state.json uniqueid: 199A0803-9643-F727-3F19-7B4278FAC269 — NEVER CHANGE
- moonwake MD5: 0dbe976bd9cfeeafe677826ffb96369d — NEVER CHANGE WITHOUT UPDATING NOTION
- Port for moonwake: 47989 (NOT 47990)
- Auto-update always targets xenstalker02/Vibepollo — NEVER Nonary/vibepollo
- NEVER delete xenstalker02/vibepollo-upstream-pr fork — holds PR #168/#169 branches

## Installer
```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" C:\Vibepollo\installer\vibepollo.iss
```
Output: `installer\output\Vibepollo-1.15.2-Setup.exe`

## Privacy scan
```bash
git diff --cached | grep "^+" | grep -v "^+++" | grep -iE "295191|7298|2951|74:56:3C|100\.100\.|100\.94\.|100\.74\.|steamdeck" || echo PRIVACY_CLEAN
```
