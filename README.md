# Vibepollo

Windows game streaming host with mic passthrough. Fork of [Apollo/Sunshine](https://github.com/LizardByte/Sunshine).

**Status:** Mic passthrough working (packets flowing, ~98% VB-Audio utilization). Audio quality fix in progress.

Pairs with **[Vibelight](https://github.com/xenstalker02/Vibelight)** on Steam Deck.

Built with [Claude Code](https://claude.ai/claude-code).

---

## Quick Install

See [INSTALL.md](INSTALL.md) for a step-by-step guide, or:

1. Download the latest release from [Releases](https://github.com/xenstalker02/Vibepollo/releases)
2. Extract and run `sunshine.exe`
3. Open `https://localhost:47990` to set up admin credentials
4. Pair from your Vibelight/Moonlight client

---

## What's Different from Sunshine/Apollo

Vibepollo is a fork of Apollo/Sunshine with the following additions:

- **Mic passthrough**: real-time forwarding of client microphone audio to the Windows host via VB-Cable, so apps like Discord, voice chat in games, etc. can use the client's mic as if it were local
- **Graceful no-mic handling**: clean warnings and session continuation when no capture device is present
- **WASAPI device recovery**: automatic detection and clean shutdown when audio devices disappear mid-session
- **Startup config validation**: enumerates WASAPI capture devices at launch and warns if the configured mic device is not found
- **Auto-update**: checks `xenstalker02/Vibepollo` releases and downloads stable versions in the background
- **VB-Cable auto-install**: installs the virtual audio cable driver on first run if not present

---

## Features

- All standard Sunshine/Apollo game streaming features (NVENC/VAAPI/software encoding, HDR, adaptive bitrate, etc.)
- **Mic passthrough**: your Steam Deck microphone appears as a Windows audio input device in real time, via VB-Audio Virtual Cable
- Auto-installs VB-Audio Virtual Cable on first run (no manual setup)
- Stable-only auto-update: checks xenstalker02/Vibepollo releases, auto-downloads stable versions in the background, applied on next restart — never auto-updates during an active stream

---

## Requirements

- Windows 10 or 11 (64-bit)
- NVIDIA GPU recommended (RTX or GTX with NVENC); AMD and software encoding also supported
- [VB-Audio Virtual Cable](https://vb-audio.com/Cable/) — auto-installed at first run if not present
- [Vibelight](https://github.com/xenstalker02/Vibelight) on Steam Deck for mic passthrough

---

## Installation

Download the latest stable release from the [Releases](https://github.com/xenstalker02/Vibepollo/releases) page.

> Installer coming soon. For now, extract the release archive and run `sunshine.exe` from the extracted folder with the build directory as the working directory.

---

## Building from Source

### Prerequisites

- MSYS2 with UCRT64 toolchain
- CMake 3.25+
- Ninja

### Build

```powershell
git clone --recurse-submodules https://github.com/xenstalker02/Vibepollo.git
cd Vibepollo
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cd build
ninja sunshine
```

Run from the build directory so relative asset paths resolve correctly:

```powershell
Start-Process -FilePath '.\sunshine.exe' -WorkingDirectory (Get-Location)
```

---

## Pairing with Vibelight (Steam Deck)

1. Start Vibepollo on your Windows PC (system tray app)
2. Install and launch [Vibelight](https://github.com/xenstalker02/Vibelight) on your Steam Deck
3. Vibelight will discover Vibepollo on your local network — add it as a host
4. Pair when prompted
5. Launch any app — mic passthrough starts automatically when the stream begins

---

## Configuration

See [`sunshine.conf.template`](sunshine.conf.template) for all available options with descriptions.

Vibepollo reads its config from `config\sunshine.conf` (relative to the working directory).

Key mic passthrough options:

| Option | Default | Description |
|--------|---------|-------------|
| `mic_sink` | `CABLE Input` | WASAPI render device to write decoded mic PCM into |
| `mic_capture_device` | `CABLE Output (VB-Audio Virtual Cable)` | Windows capture device set as default input during sessions |
| `install_vbcable` | `true` | Auto-install VB-Audio CABLE if not present |

Example `sunshine.conf`:

```
mic_sink = CABLE Input
mic_capture_device = CABLE Output (VB-Audio Virtual Cable)
```

---

## Known Issues / WIP

- Audio quality: mic audio may have occasional glitches (buffer tuning in progress)
- No GUI installer yet — manual extraction required
- Mic passthrough requires VB-Audio Virtual Cable (free, auto-installed)
- System tray-only mode not yet implemented

---

## Future Plans

- Full installer with silent install support
- System tray-only mode (no web UI required)
- Multi-platform client support (Windows, macOS, Android via Vibelight)
- Configurable Opus codec settings (bitrate, channels)
- End-to-end latency display in tray

---

## Security

Mic packets travel inside the encrypted Moonlight control stream (AES-GCM, `SS_ENC_CONTROL_V2`).
Clients that do not negotiate an encrypted control stream will have mic passthrough refused — plaintext mic audio is never rendered.

---

## Related Projects
- [logabell/Apollo](https://github.com/logabell/Apollo) -- parallel server-side mic passthrough implementation
- [logabell/moonlight-qt-mic](https://github.com/logabell/moonlight-qt-mic) -- parallel client-side mic passthrough
- [Nonary/vibepollo](https://github.com/Nonary/vibepollo) -- our direct upstream
- [ClassicOldSong/Apollo](https://github.com/ClassicOldSong/Apollo) -- Apollo upstream
- [LizardByte/Sunshine](https://github.com/LizardByte/Sunshine) -- main Sunshine project

## Contributing
PRs are welcome. Our goal is to contribute mic passthrough upstream to ClassicOldSong/Apollo and Nonary/vibepollo after community testing. See [CONTRIBUTING.md](CONTRIBUTING.md) and [UPSTREAM.md](UPSTREAM.md).
