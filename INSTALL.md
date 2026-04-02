# Vibepollo Installation Guide

## Requirements

- **Windows 10 or 11** (64-bit)
- **NVIDIA GPU** recommended (NVENC hardware encoding); AMD and Intel GPUs also supported
- **Steam** running on the PC (provides the Steam Streaming Microphone virtual audio device used for mic passthrough). VB-Audio Virtual Cable is installed as an automatic fallback.
- A [Vibelight](https://github.com/xenstalker02/Vibelight) client on your Steam Deck

## Download and Run

1. Download `Vibepollo-1.15.2-Setup.exe` from [GitHub Releases](https://github.com/xenstalker02/Vibepollo/releases)
2. Run the installer — it handles everything automatically
3. Open the web UI at `https://localhost:47990` to complete initial setup

## Mic Passthrough Setup

Vibepollo uses **Steam Streaming Microphone** as the primary mic backend — no
third-party driver required. Steam's audio driver (installed with Steam) provides
the virtual microphone endpoint. VB-Audio Virtual Cable is installed automatically
as a fallback in case Steam is unavailable.

No manual audio device setup is required. At session start, Vibepollo switches the
Windows default capture device to Microphone (Steam Streaming Microphone), and
restores it to your previous default when the session ends. Discord set to
"Default" picks up the client mic automatically.

### Key config options (sunshine.conf)

| Option | Default | Description |
|--------|---------|-------------|
| `mic_sink` | `Speakers (Steam Streaming Microphone)` | Render endpoint for mic audio |
| `mic_capture_device` | `Microphone (Steam Streaming Microphone)` | Windows default capture device set at session start |
| `mic_buffer_packets` | `2` | Jitter buffer prebuffer depth (1 packet = 20ms) |

## Configuration (sunshine.conf)

Vibepollo reads its configuration from `sunshine.conf` in the config directory (`%PROGRAMDATA%\Vibepollo\config\` by default).

See `sunshine.conf.template` in the repository root for all available options with descriptions.

### Example sunshine.conf

```
sunshine_name = MyGamingPC
mic_sink = Speakers (Steam Streaming Microphone)
mic_capture_device = Microphone (Steam Streaming Microphone)
```

## Pairing with Vibelight Client

1. Start Vibepollo on your Windows PC.
2. On your Steam Deck, open Vibelight.
3. Add a new host using your PC's IP address.
4. The client will display a 4-digit PIN.
5. Enter the PIN in the Vibepollo web UI at `https://localhost:47990` under the PIN pairing section.
6. Once paired, your PC will appear in the client's host list.

## Troubleshooting Quick Links

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions
- [Vibepollo Web UI](https://localhost:47990) for live logs and configuration
- Check the log file at `%PROGRAMDATA%\Vibepollo\config\logs\` for detailed diagnostics
