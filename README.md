![Vibepollo](vibepollo_final.png)

> **Vibepollo** is a fork of [Nonary/vibepollo](https://github.com/Nonary/vibepollo)
> (itself a fork of [ClassicOldSong/Apollo](https://github.com/ClassicOldSong/Apollo))
> that adds **encrypted microphone passthrough** from a Vibelight client
> to the Windows host during a game streaming session.
> Built with AI assistance (Claude Code) by a UX designer — hence the name.

[![License](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

---

## What Is This?

When you stream games from your Windows PC to your Steam Deck,
your microphone stays on your PC — the client mic is ignored. Vibepollo fixes that.

It pairs with **[Vibelight](https://github.com/xenstalker02/Vibelight)** on the client side.
Vibelight captures mic audio on the Steam Deck, Opus-encodes it, and streams it back to
Vibepollo, which renders it as a virtual microphone input that Windows applications can use
for voice chat, Discord, games, and anything else.

---

## Features

- **Encrypted mic passthrough** — mic audio rides the AES-GCM encrypted control stream
  (SS_ENC_CONTROL_V2). Plaintext mic is refused. No unencrypted audio on the network.
- **Steam Streaming Microphone** — decoded mic audio is written directly to the Steam
  Streaming Microphone render endpoint. No third-party driver required — uses the
  Steam audio driver already installed with Steam. Vibepollo normalizes the endpoint
  format to 2ch/32-bit/48kHz before WASAPI initialization.
- **Opus audio** — 64kbps mono, FEC enabled, 20ms frames. Low latency, excellent
  voice quality, robust to packet loss.
- **Per-session decoder** — each streaming session gets its own Opus decoder and WASAPI
  render client. Multiple concurrent sessions do not corrupt each other's audio.
- **Session stats and diagnostics** — logs packet count, PLC events, decode errors,
  audio level, and latency every 30 seconds during active mic sessions.
- **All Apollo/Nonary features** — virtual display, HDR, Playnite integration, and
  everything else from the upstream forks.

---

## Requirements

**Windows PC (host):**
- Windows 10 or 11
- Steam running on the PC (provides the Steam Streaming Microphone audio driver)
- GPU: NVIDIA (NVENC), AMD, or Intel (QuickSync)

**Steam Deck (client):**
- [Vibelight](https://github.com/xenstalker02/Vibelight) — the companion Moonlight fork
  with client-side mic capture

---

## Installation

### Easy Install (Recommended)

1. Download `Vibepollo-1.15.4-Setup.exe` from
   [Releases](https://github.com/xenstalker02/Vibepollo/releases)
2. Run the installer — it handles everything automatically:
   - Installs to `C:\Program Files\Vibepollo\`
   - Configures Windows Firewall rules (TCP 47984/47989/47990, UDP 47998-48010)
   - Sets up autostart on login via Task Scheduler (30-second delay for audio init)
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
| `mic_sink` | `Speakers (Steam Streaming Microphone)` | Render endpoint for mic passthrough. Vibepollo writes decoded Opus audio here. Steam must be running for this endpoint to be present. |
| `mic_capture_device` | `Microphone (Steam Streaming Microphone)` | Capture device Vibepollo switches Windows default input to at session start, so Discord (on Default) picks up the client mic. Restored to previous default on session end. |
| `mic_buffer_packets` | `2` | Jitter buffer prebuffer depth in Opus packets (1 packet = 20ms). Default 2 = 40ms prebuffer. Range 1–16. Increase if audio drops; decrease if latency is too high. |

The web UI at `https://localhost:47990` provides a graphical interface for most settings.

### Windows Application Setup

Set Discord (and other voice apps) input to **Default** — that's all. At session start,
Vibepollo switches the Windows default capture device to **Microphone (Steam Streaming
Microphone)**, so Discord automatically picks up the client mic. At session end, the
default capture restores to your previous default device. No manual switching needed.

**Games that don't pick up the device switch automatically:** Some games cache the
Windows default audio device at launch and ignore changes made mid-session. If a game
doesn't detect the client mic, go into the game's audio settings and manually select
**Microphone (Steam Streaming Microphone)** as the microphone input — this is a
one-time per-game setting. Vibepollo re-applies the device switch at 2, 5, 10, and
20 seconds after session start to catch games that init audio after process launch.

---

## Security

Mic packets are encrypted as part of the AES-GCM encrypted Moonlight control stream
(`SS_ENC_CONTROL_V2`). Vibepollo **refuses to render mic audio** from clients that did not
negotiate an encrypted control stream. Plaintext mic passthrough is never permitted.

---

## How Mic Passthrough Works

```
Steam Deck mic
→ SDL2 capture (48kHz, 16-bit, stereo or mono)
→ (L+R)/2 downmix to mono
→ Opus encode (64kbps mono, FEC, 20ms frames)
→ 4-byte header prepended (channel/flags)
→ AES-GCM encrypted control stream (SS_ENC_CONTROL_V2)
→ Vibepollo receives 0x3003 packets
→ Jitter buffer (40ms prebuffer, 2 packets default)
→ Opus decode with PLC on packet loss
→ WASAPI render → Steam Streaming Microphone render endpoint
→ Vibepollo switches Windows default capture to Microphone (Steam Streaming Microphone)
→ Discord (set to Default) picks up client mic automatically
→ Session end: default capture restores to previous default device
```

---

## Platform Support

| Platform | Status |
|----------|--------|
| Windows 10 / 11 (host) | Supported |
| Linux | Not supported |
| macOS | Not supported |

---

## Related Projects

| Project | Description |
|---------|-------------|
| [Vibelight](https://github.com/xenstalker02/Vibelight) | Companion Moonlight fork with client mic capture |
| [logabell/Apollo](https://github.com/logabell/Apollo) | Parallel server-side mic passthrough implementation |
| [logabell/moonlight-qt-mic](https://github.com/logabell/moonlight-qt-mic) | Parallel client-side mic implementation — **not compatible with Vibelight** (uses LiSendMicrophoneOpusDataEx on a separate UDP port; Vibelight uses 0x3003 on the encrypted control stream) |
| [Nonary/vibepollo](https://github.com/Nonary/vibepollo) | Our direct upstream |
| [ClassicOldSong/Apollo](https://github.com/ClassicOldSong/Apollo) | Apollo upstream |
| [LizardByte/Sunshine](https://github.com/LizardByte/Sunshine) | Sunshine upstream |

---

## Acknowledgments

See [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md) for full credits.

Mic passthrough was developed in parallel with [logabell](https://github.com/logabell).
We compared implementations and adopted Opus encoder tuning (64kbps mono, reduced
from Logan's original 96kbps for VOIP tuning; FEC, VBR, complexity 10,
FRAMESIZE_20_MS) and the deadline-based send pacer from that work.
