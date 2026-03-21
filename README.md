# Vibepollo

> **Vibepollo** is a fork of [Nonary/vibepollo](https://github.com/Nonary/vibepollo)
> (itself a fork of [ClassicOldSong/Apollo](https://github.com/ClassicOldSong/Apollo))
> that adds **encrypted microphone passthrough** from a Moonlight/Vibelight client
> to the Windows host during a game streaming session.

[![Build](https://github.com/xenstalker02/Vibepollo/actions/workflows/build.yml/badge.svg)](https://github.com/xenstalker02/Vibepollo/actions)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

---

## What Is This?

When you stream games from your Windows PC to a Steam Deck (or other Moonlight client),
your microphone stays on your PC — the client mic is ignored. Vibepollo fixes that.

It pairs with **[Vibelight](https://github.com/xenstalker02/Vibelight)** on the client side.
Vibelight captures mic audio on the Steam Deck, Opus-encodes it, and streams it back to
Vibepollo, which renders it as a virtual microphone input that Windows applications can use
for voice chat, Discord, games, and anything else.

---

## Features

- **Encrypted mic passthrough** — mic audio rides the AES-GCM encrypted control stream
  (SS_ENC_CONTROL_V2). Plaintext mic is refused. No unencrypted audio on the network.
- **Steam Streaming Microphone** — uses Steam's built-in virtual mic driver as the
  primary audio sink. No third-party dependencies required if Steam is installed.
- **VB-Cable fallback** — if Steam Streaming Microphone is not available, automatically
  falls back to VB-Cable. Auto-installs VB-Cable as a last resort.
- **Opus audio** — 64kbps VBR, complexity 10, FEC enabled, 20ms frames. Low latency,
  excellent voice quality, robust to packet loss.
- **Per-session decoder** — each streaming session gets its own Opus decoder and WASAPI
  render client. Multiple concurrent sessions do not corrupt each other's audio.
- **Session stats and diagnostics** — logs packet count, PLC events, decode errors,
  audio level, and latency every 30 seconds during active mic sessions.
- **Moonwake integration** — pairs with the wake-on-LAN system in Vibelight for
  one-tap sleep-and-stream from the Steam Deck with HOME/AWAY path detection.
- **All Apollo/Nonary features** — virtual display, HDR, Playnite integration, and
  everything else from the upstream forks.

---

## Requirements

**Windows PC (host):**
- Windows 10 or 11
- Steam installed (for Steam Streaming Microphone driver)
- GPU: NVIDIA (NVENC), AMD, or Intel (QuickSync)

**Steam Deck / Client:**
- [Vibelight](https://github.com/xenstalker02/Vibelight) — the companion Moonlight fork
  with client-side mic capture

---

## Installation

### Easy Install (Recommended)

1. Download `Vibepollo-1.14.13-beta.2-Setup.exe` from
   [Releases](https://github.com/xenstalker02/Vibepollo/releases)
2. Run the installer — it handles everything automatically:
   - Installs to `C:\Program Files\Vibepollo\`
   - Configures Windows Firewall rules (TCP 47984/47989/47990, UDP 47998-48010)
   - Sets up autostart on login via Task Scheduler (30-second delay for audio init)
   - Installs Steam Streaming Microphone driver if not present
   - Creates Start Menu shortcut
   - Opens the web UI on first run for initial setup
3. Install [Vibelight](https://github.com/xenstalker02/Vibelight) on your Steam Deck
4. Pair Vibelight with Vibepollo via the web UI at `https://localhost:47990`

### Build From Source

Requirements: MSYS2 with UCRT64 toolchain, CMake, Ninja

```bash
git clone https://github.com/xenstalker02/Vibepollo.git
cd Vibepollo
mkdir build && cd build
cmake .. -G Ninja -DCMAKE_BUILD_TYPE=Release
ninja sunshine
```

Run from the build directory (working directory must be the build folder):

```powershell
Start-Process -FilePath '.\sunshine.exe' -WorkingDirectory (Get-Location).Path
```

To rebuild the installer after making changes:

```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\vibepollo.iss
```

---

## Configuration

Vibepollo is configured via `sunshine.conf` in the config directory.
See [`sunshine.conf.template`](sunshine.conf.template) for all available options.

Key mic passthrough options:

| Option | Default | Description |
|--------|---------|-------------|
| `mic_sink` | `CABLE Input` | Primary virtual mic device. Falls back to Steam Streaming Mic automatically if not found. |
| `mic_capture_device` | `CABLE Output (VB-Audio Virtual Cable)` | Windows capture device for mic audio |
| `mic_buffer_ms` | `50` | WASAPI render buffer size in ms (10-200). 50ms recommended for stability. |
| `install_steam_drivers` | `true` | Auto-install Steam audio drivers if not present |

The web UI at `https://localhost:47990` provides a graphical interface for most settings.

---

## Security

Mic packets are encrypted as part of the AES-GCM encrypted Moonlight control stream
(`SS_ENC_CONTROL_V2`). Vibepollo **refuses to render mic audio** from clients that did not
negotiate an encrypted control stream. Plaintext mic passthrough is never permitted.

---

## How Mic Passthrough Works

```
Steam Deck mic
→ SDL2 capture (48kHz, 16-bit, mono)
→ Opus encode (64kbps, VBR, FEC, 20ms frames)
→ Deadline-based pacer (exactly 20ms intervals with re-sync guard)
→ AES-GCM encrypted control stream (SS_ENC_CONTROL_V2)
→ Vibepollo receives 0x3003 packets
→ Opus decode with PLC on packet loss
→ WASAPI render → Steam Streaming Microphone (primary)
→ VB-Cable Input (fallback)
→ Windows sees "Microphone (Steam Streaming Microphone)"
→ Discord / games / voice chat work normally
```

---

## Moonwake (One-Tap Stream)

Vibepollo pairs with the Moonwake system built into Vibelight:
- **HOME path**: detects LAN, connects directly at full speed (150Mbps+, HDR)
- **AWAY path**: detects remote network, wakes PC via Raspberry Pi WOL, connects via Tailscale
- One tap in Steam Game Mode — the PC wakes up and streaming starts automatically

---

## Related Projects

| Project | Description |
|---------|-------------|
| [Vibelight](https://github.com/xenstalker02/Vibelight) | Companion Moonlight fork with client mic capture |
| [logabell/Apollo](https://github.com/logabell/Apollo) | Parallel server-side mic passthrough implementation |
| [logabell/moonlight-qt-mic](https://github.com/logabell/moonlight-qt-mic) | Parallel client-side mic implementation |
| [Nonary/vibepollo](https://github.com/Nonary/vibepollo) | Our direct upstream |
| [ClassicOldSong/Apollo](https://github.com/ClassicOldSong/Apollo) | Apollo upstream |
| [LizardByte/Sunshine](https://github.com/LizardByte/Sunshine) | Sunshine upstream |

---

## Contributing

PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions and guidelines.

Our goal is to contribute mic passthrough upstream to ClassicOldSong/Apollo once
community testing is complete. The PR draft is at
[docs/UPSTREAM_PR_DRAFT.md](docs/UPSTREAM_PR_DRAFT.md).

---

## Acknowledgments

See [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md) for full credits.

Mic passthrough was developed in parallel with [logabell](https://github.com/logabell).
We compared implementations and adopted Opus encoder tuning (64kbps, FEC, VBR,
complexity 10, FRAMESIZE_20_MS), the deadline-based send pacer, Steam Streaming
Microphone support, and 12-frame buffer overflow protection from that work.
