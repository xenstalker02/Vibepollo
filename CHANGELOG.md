# Changelog

## [Unreleased]

### Added
- Mic passthrough via 0x3003 control stream packets — streams client
  microphone audio to host PC in real time via VB-Audio Virtual Cable at 96kbps VBR
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
- Opus packets validated via `opus_packet_parse()` before jitter buffer insertion — malformed packets silently discarded instead of passed to decoder
- Frame size derived per-packet via `opus_packet_get_nb_samples()` replacing hardcoded 960 — compatible with variable Opus frame durations
- Wire header ch/flags validated on every mic packet (ch=1, flags=0 required) — invalid mic stream headers rejected before decoding
- WASAPI render thread failure propagated to `write()` via `render_dead` atomic — mic session self-terminates cleanly on device loss instead of queuing silently
- Capture device switching snapshots all 3 ERole defaults (eConsole, eCommunications, eMultimedia) before switching — all three roles restored on session end, no lingering capture override
- Mic session initialization refactored from 4-level nested conditionals to flat early-return lambda — no behavior change
- `virtual_microphone()` interface updated to `(device_name, sample_rate, frame_size)` removing unused `channels` parameter
- Removed `install_steam_audio_drivers` config option and UI checkbox —
  Steam Streaming Speakers are not usable with Apollo/Moonlight protocol;
  VB-Audio Virtual Cable is the correct and only supported architecture
- VB-Audio Virtual Cable now installed automatically by the Vibepollo installer;
  auto-install at runtime via `install_vbcable` option remains as fallback
- `virtual_sink_placeholder` UI hint updated from "Steam Streaming Speakers"
  to "CABLE Input"
- Update checks now target `xenstalker02/Vibepollo` stable releases only;
  pre-release versions never auto-applied
- `mic_capture_device` no longer hardcoded — configurable in sunshine.conf
- VB-Cable install skipped if `CABLE Input` device already present
- Build subsystem changed to WIN32 — no console window on launch (tray only)
- zlib1.dll resolved from MSYS2 toolchain when Apollo/Sunshine not installed
- Startup via watchdog VBScript for automatic crash recovery
