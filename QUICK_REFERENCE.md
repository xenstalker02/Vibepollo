# Vibepollo Quick Reference
Last updated: 2026-03-21

## Current State
| Repo | Commit | Description |
|------|--------|-------------|
| Vibepollo | 56f9372e | docs: README reflects Steam mic as primary, VB-Cable fallback |
| Vibelight | f1cfb4a2 (flatpak) | SIGABRT fix: kMaxPacketSize=200, kDefaultBitrate=48000 |

Both repos pushed to GitHub. Local PC and Deck in sync.

### Mic Architecture
- Steam Streaming Mic: **PRIMARY** (WASAPI enum at session init) — commit eecdfb2b
- VB-Cable: **FALLBACK only** (mic_sink config, default "CABLE Input")
- micDevice/micBitrate: fully wired to MicCapture in session.cpp (already implemented)
- Vibelight SIGABRT fix: confirmed in binary f1cfb4a2 (kMaxPacketSize=200, kDefaultBitrate=48000)

## Known Fixed (2026-03-20)
- Display helper error:5 (ACCESS_DENIED) storm: added 200ms unconditional stabilization delay + 3-retry loop on non-force_restart path
- Mic null pointer guards: try-catch on init_mic_redirect_device and write_mic_data in audio.cpp
- WASAPI exception handling: both init and write paths now catch (...) and disable mic gracefully rather than crashing
- WASAPI render format log: [mic] WASAPI render format: Xch XHz Xbit logged on session start
- Stall detection renamed to [mic] WARNING: render stall detected for consistency

## Autostart
Vibepollo autostarts via Windows Task Scheduler on login (30-second delay for audio init).

| Setting | Value |
|---------|-------|
| Task name | Vibepollo |
| Binary | C:\Vibepollo\build\sunshine.exe |
| Working dir | C:\Vibepollo\build |
| Trigger | ONLOGON |
| Privilege | HIGHEST |
| Delay | 30 seconds |

To disable: open Task Scheduler → find Vibepollo → Disable
To re-enable: Task Scheduler → Vibepollo → Enable

Manual rebuild and restart:
```
cd /c/Vibepollo/build && PATH="/c/msys64/ucrt64/bin:/c/msys64/usr/bin:$PATH" ninja sunshine
cmd /c "taskkill /IM sunshine.exe /F"
powershell -Command "Start-Process -FilePath 'C:\Vibepollo\build\sunshine.exe' -WorkingDirectory 'C:\Vibepollo\build'"
```

## How to Start Claude Code
```
cd C:\Vibepollo && claude --dangerously-skip-permissions
```

## Key Technical Facts
- Encryption: mic data rides SS_ENC_CONTROL_V2 AES-GCM control stream (structural, no per-packet overhead)
- Plaintext mic: refused at session init AND packet handler (encryption_failures counter tracks drops)
- Our approach is architecturally cleaner than Logan's AES-CBC separate UDP socket approach
- Upstream: now in sync with Nonary/vibepollo (47 commits merged 2026-03-20)
- Remaining diff from upstream: only our mic passthrough files (config.h, config.cpp, stream.cpp, audio.cpp, main.cpp, platform/common.h, update.cpp/h)
- LiSendMicrophoneOpusDataEx: NOT in our moonlight-common-c (625a7d7) — Vibelight stays on 0x3003
- Logan's PR #1428 to ClassicOldSong/Apollo: OPEN (not yet merged)

## moonlight_wake.sh
Current MD5: c1d41731c6b7f53e9dc9878437b40bd1
NEVER modify without updating this MD5 everywhere it appears.

## Device Quick Reference
| Device | Access | Key Path |
|--------|--------|----------|
| PC | local | C:\Vibepollo\ |
| PC Tailscale | [see local notes] | Config: C:\Vibepollo\build\config\ |
| Deck SSH | deck@[deck-hostname] | Vibelight: /home/deck/vibelight |
| Pi SSH | xenstalker02@piwaker | WOL: /usr/local/bin/wake-pc |
| Pi Tailscale | [see local notes] | |

sunshine_state.json uniqueid: 199A0803-9643-F727-3F19-7B4278FAC269 — NEVER CHANGE

## Installer
Script: `C:\Vibepollo\installer\vibepollo.iss`
Output: `C:\Vibepollo\installer\output\Vibepollo-1.14.13-beta.2-Setup.exe`

To rebuild installer:
```
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" C:\Vibepollo\installer\vibepollo.iss
```

Installer does:
- Installs to `C:\Program Files\Vibepollo\`
- Firewall rules: TCP 47984/47989/47990, UDP 47998-48010
- Task Scheduler autostart (ONLOGON, HIGHEST, 30s delay)
- Steam Streaming Mic driver (if Steam detected)
- Start Menu shortcut + optional desktop shortcut
- Launches Vibepollo + opens web UI on first run
- Preserves config on uninstall, removes firewall/task on uninstall

## Tasks

### DONE (2026-03-21 session)
- Steam Streaming Mic as primary, VB-Cable fallback (audio.cpp — eecdfb2b)
- Mic config (mic_sink) in web UI Audio/Video tab (already present from previous session)
- Mic Passthrough placeholder section added to Troubleshooting page (69c2346d)
- Nonary upstream sync: 0 new commits (already up to date)
- micDevice/micBitrate: already fully wired to MicCapture in session.cpp (no changes needed)
- sunshine.conf.template mic_sink comment updated to "fallback device" (56f9372e)
- Vibepollo installer: Inno Setup — see Installer section above

### STILL PENDING
- Test AWAY path: hotspot → Pi → Tailscale → stream
- Test Bluetooth Nothing (1) headphones as mic input
- Reboot PC for hostname rename
- Change Deck SSH password (currently [deck-pw])
- Change Pi SSH passwords ([pi-pw])
- Demo video (60 sec)
- Reply to Logan on PR #1428 with test results
- PR to ClassicOldSong/Apollo (after E2E test + demo)
- LiSendMicrophoneOpusDataEx migration (waiting on moonlight-common-c PR #1)
- Clipboard sync (needs Apollo protocol + Vibelight client side)
- Set GitHub repo topics manually — copy from C:\Vibepollo\.github\topics.txt

## Reply to Logan (PR #1428)
Post at: https://github.com/ClassicOldSong/Apollo/pull/1428

Message:
"Hey Logan — following up on my earlier comment. I've now implemented encrypted Steam
Streaming Mic on both server and client sides. My approach differs from yours: mic data
rides the existing AES-GCM encrypted control stream (SS_ENC_CONTROL_V2) rather than a
separate UDP socket — encryption is structural with no per-packet overhead.
I also fixed the concurrent session decoder bug (P1) and session routing is inherently
NAT-safe via control stream context (P2 equivalent).
I adopted your deadline pacer, buffer overflow cap, and Opus tuning and credited you in
ACKNOWLEDGMENTS.md. Happy to collaborate on a combined PR or compare notes.
Repos: https://github.com/xenstalker02/Vibepollo and https://github.com/xenstalker02/Vibelight"

## PR Draft Location
C:\Vibepollo\docs\UPSTREAM_PR_DRAFT.md
Target: ClassicOldSong/Apollo — OPEN ONLY after E2E test + installer done
ClassicOldSong requirements met: encrypted mic, Steam Streaming Mic, per-session decoder

## Community Status
- Logan's PR #1428 to ClassicOldSong/Apollo: OPEN
- xenstalker02 commented — Logan has seen our repos
- ClassicOldSong requirements: encrypted mic (done), Steam Streaming Mic (done)
- Codex P1 (concurrent decoder): fixed
- Codex P2 (NAT routing): inherently safe via control stream context
