# Vibepollo Installation Guide

## Requirements

- **Windows 10 or 11** (64-bit)
- **NVIDIA GPU** recommended (NVENC hardware encoding); AMD and Intel GPUs also supported
- **VB-Cable** virtual audio driver (for mic passthrough)
- A Vibelight or Moonlight client on your streaming device

## Download and Run

1. Download the latest release from [GitHub Releases](https://github.com/xenstalker02/Vibepollo/releases).
2. Extract the archive to a folder of your choice (e.g., `C:\Vibepollo`).
3. Run `sunshine.exe` or use the provided `Launch.bat` to start without a console window.
4. On first launch, Vibepollo will open the web UI at `https://localhost:47990` to set an admin username and password.

## VB-Cable Setup

VB-Cable is required for mic passthrough (forwarding your client device's microphone to the host PC).

1. Download VB-Cable from [vb-audio.com/Cable](https://vb-audio.com/Cable/).
2. Run the installer **as Administrator**.
3. Reboot after installation.
4. Verify two new audio devices appear:
   - **CABLE Input** (playback device)
   - **CABLE Output (VB-Audio Virtual Cable)** (recording device)

Vibepollo can also auto-install VB-Cable if `install_vbcable = enabled` is set in your config.

## Configuration (sunshine.conf)

Vibepollo reads its configuration from `sunshine.conf` in the config directory (`%PROGRAMDATA%\Vibepollo\config\` by default).

See `sunshine.conf.template` in the repository root for all available options with descriptions.

### Key Mic Passthrough Options

| Option | Default | Description |
|--------|---------|-------------|
| `mic_sink` | `CABLE Input` | The WASAPI render endpoint where decoded client mic audio is written. Set to empty to disable mic passthrough. |
| `mic_capture_device` | `CABLE Output (VB-Audio Virtual Cable)` | The recording device set as Windows default input during streaming so host apps (Discord, etc.) pick up the client mic. |
| `sunshine_name` | *(hostname)* | The name advertised to Moonlight/Vibelight clients. |

### Example sunshine.conf

```
sunshine_name = MyGamingPC
mic_sink = CABLE Input
mic_capture_device = CABLE Output (VB-Audio Virtual Cable)
```

## Pairing with Vibelight Client

1. Start Vibepollo on your Windows PC.
2. On your client device, open Vibelight (or Moonlight).
3. Add a new host using your PC's IP address.
4. The client will display a 4-digit PIN.
5. Enter the PIN in the Vibepollo web UI at `https://localhost:47990` under the PIN pairing section.
6. Once paired, your PC will appear in the client's host list.

## Troubleshooting Quick Links

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions
- [Vibepollo Web UI](https://localhost:47990) for live logs and configuration
- Check the log file at `%PROGRAMDATA%\Vibepollo\config\logs\` for detailed diagnostics
