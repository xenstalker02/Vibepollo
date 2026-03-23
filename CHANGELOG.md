# Changelog

## [Unreleased]

### Added
- Mic passthrough via 0x3003 control stream packets — streams client
  microphone audio to host PC in real time via VB-Audio Virtual Cable
- VB-Audio Virtual Cable auto-install on first run (skipped if already present)
- Configurable `mic_sink`, `mic_capture_device`, `mic_buffer_packets`,
  and `mic_buffer_ms` settings in sunshine.conf
- `mic_buffer_packets` — jitter buffer prebuffer depth (default 3, range 1–16);
  tunable without rebuild for latency vs stability tradeoff
- VB-Cable startup detection — logs driver version when found, warning when absent
- Per-session Opus decoder isolation — decoder and speaker re-created fresh on
  every reconnect; no shared state between sessions
- Auto-update for stable releases only — downloads silently in background,
  applied on next restart, never during an active stream session
- Log rotation — keeps the 10 most recent log files on each startup
- First-run browser launch to https://localhost:47990 for initial setup
- VB-Audio Virtual Cable version logged at startup for diagnostics
- Automatic firewall rule management via Windows Defender Firewall

### Fixed
- Desktop pseudo-app (placebo) no longer fires "Application Stopped" toast
- Update notification deduplicated — fires once per version, not every stream start
- "Application Started" and "Application Stopped" tray toasts fire exactly once per app
  session; reconnect cycles within the same app do not repeat the notification
- Per-second mic packet count log moved from INFO to DEBUG (quieter normal operation)
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
