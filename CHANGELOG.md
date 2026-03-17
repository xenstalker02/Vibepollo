# Changelog

## [Unreleased]

### Added
- Mic passthrough via 0x3003 control stream packets — streams client
  microphone audio to host PC in real time via VB-Audio Virtual Cable
- VB-Audio Virtual Cable auto-install on first run (skipped if already present)
- Configurable `mic_sink` and `mic_capture_device` settings in sunshine.conf
- Auto-update for stable releases only — downloads silently in background,
  applied on next restart, never during an active stream session
- Log rotation — keeps the 10 most recent log files on each startup
- First-run browser launch to https://localhost:47990 for initial setup
- VB-Audio Virtual Cable version logged at startup for diagnostics
- Automatic firewall rule management via Windows Defender Firewall

### Fixed
- Stream disconnect hang — MicCapture SDL audio thread blocking on stop;
  fixed with non-blocking atomic stop flag
- WASAPI render buffer too small for Opus frame size — increased to 200ms
  to prevent choppy audio at CABLE Input
- WinSock include ordering conflict with Boost.Asio headers in update.cpp

### Changed
- Update checks now target `xenstalker02/Vibepollo` stable releases only;
  pre-release versions never auto-applied
- `mic_capture_device` no longer hardcoded — configurable in sunshine.conf
- VB-Cable install skipped if `CABLE Input` device already present
- Build subsystem changed to WIN32 — no console window on launch (tray only)
- zlib1.dll resolved from MSYS2 toolchain when Apollo/Sunshine not installed
- Startup via watchdog VBScript for automatic crash recovery
