# Changelog

## [1.15.3] — 2026-04-01

### Fixed (2026-04-01)
- **Startup capture restore guard**: if Vibepollo is hard-killed mid-stream
  (power loss, forced kill), Windows default capture is automatically restored
  on next startup. Saves pre-session default to `build/config/mic_capture_prev.txt`
  at session start; reads and restores on next boot if the file exists and the
  default is still pointing at the passthrough device.
- **Tray paused/stopped race fixed**: stream teardown now polls `proc.running()` for
  up to 2 seconds before deciding paused vs stopped. Prevents the race where quitting
  a game and immediately disconnecting always showed "Streaming paused" instead of
  "Application Stopped" because the process was still alive during teardown.
- **Desktop/placebo tray idle state**: when the running app is a Desktop pseudo-app
  (placebo), the tray now resets to idle state on client disconnect instead of
  showing "Streaming paused for Desktop". `proc.running()` always returns true for
  placebo apps; the previous behaviour incorrectly flagged every Desktop session end
  as paused. New `update_tray_idle()` resets icon and tooltip silently with no toast.
- **WASAPI device-lost recovery**: mic render thread now detects `GetCurrentPadding`
  failure, automatically re-finds the render endpoint, and re-initialises WASAPI
  without dropping the session. Only marks `render_dead` if re-init also fails.
  Logs the first dropped `write_pcm` call after a dead render client is detected.

## [1.15.2] — 2026-04-01
### Merged
- Upstream Nonary/Vibepollo 1.15.0-stable.2: monitor position preservation,
  monitor refresh rate fixes during virtual display setup, display cleanup fixes,
  bootstrapper improvements.

## [1.15.1] — 2026-04-01

### Fixed
- **System tray now initializes reliably on first launch** — `Shell_NotifyIconA(NIM_DELETE)`
  is now called before `NIM_ADD` to clear any orphaned GUID entry left by a previous
  crash. Previously the tray GUID (kTrayGuid) could persist in the Windows Shell database
  after an unclean shutdown, causing all 30 initialization attempts to fail with
  `0x80004005 E_FAIL`, leaving the process with no tray icon and no toast notifications.
- **Toast notification early-return guard removed** — the guard that skipped
  notification field assignment when the tray icon was already `TRAY_ICON_PLAYING`
  prevented all subsequent toasts from ever firing after the first session. Toast
  flags are now managed solely by the 30-second gap reset logic.

## [1.15.0] — 2026-03-31

### Fixed
- **Toast notifications restored** — per-app flags now reset after 30-second gap
  between sessions, restoring started/stopped toasts for intentional new sessions
  while still suppressing toasts during rapid client reconnect cycles (< 30s).
  Previously flags were never reset for the same app name, causing all toasts to
  disappear after the first session.

### Changed
- **WASAPI render prebuffer reduced from 80ms to 40ms** — both Steam mic and
  VB-Cable render backends now prebuffer 2 Opus packets (40ms) matching the jitter
  buffer depth, reducing time-to-first-audio from ~120ms to ~80ms.
- **Installer version bumped to 1.15.0** to reflect current upstream base.

### Added (2026-03-28)
- **Steam Streaming Microphone as primary mic backend** (`mic_write_wasapi_t` +
  `apollo_vmic_t`) — writes decoded Opus audio directly to the Steam audio driver
  render endpoint. No third-party driver required. Endpoint format normalized to
  2ch/32-bit/48kHz via IPolicyConfig before WASAPI initialization.
- **VB-Audio Virtual Cable as automatic fallback** — if Steam Streaming Microphone
  is unavailable (Steam not running or endpoint absent), Vibepollo automatically
  falls back to CABLE Input without any configuration change.
- **Abstract mic redirect backend** (`mic_redirect_backend_t`) — clean interface
  allowing future backends without touching stream.cpp or audio.cpp call sites.
- `init_mic_redirect_device()`, `release_mic_redirect_device()`, `write_mic_pcm()`
  virtual methods added to `audio_control_t` for backend-agnostic session routing.

### Fixed (2026-03-28)
- **Root cause of Steam Streaming Microphone failures**: `SetDeviceFormat` (IPolicyConfig)
  requires `KSDATAFORMAT_SUBTYPE_PCM` for the device format. Previous attempts used
  `KSDATAFORMAT_SUBTYPE_IEEE_FLOAT`, causing WASAPI `Initialize()` to fail with
  `0x88890008`. WASAPI `Initialize()` itself still uses float32 — these are separate
  calls with different format requirements.
- **Stream.cpp null-speaker guard** — `if (!session->mic.speaker || ...)` was
  short-circuiting the Steam mic path (which intentionally leaves `speaker` null
  when `audio_ctrl` is set). Fixed to `if ((!speaker && !audio_ctrl) || ...)`.

### Changed (2026-03-28)
- `mic_buffer_packets` default raised from 3 to 2 (40ms prebuffer) — confirmed
  stable at 40ms with friend test 2026-03-28 evening.
- Default `mic_sink` changed from `CABLE Input` to `Speakers (Steam Streaming Microphone)`.
- Default `mic_capture_device` changed from `CABLE Output (VB-Audio Virtual Cable)`
  to `Microphone (Steam Streaming Microphone)`.
- Opus bitrate on the client (Vibelight) changed from 96kbps to 64kbps mono;
  (L+R)/2 stereo downmix applied before encode.
- `mic_buffer_ms` config option superseded by `mic_buffer_packets` for
  packet-count-based prebuffer tuning.

## [Initial Release]

### Added
- Mic passthrough via 0x3003 control stream packets — streams client
  microphone audio to host PC in real time via VB-Audio Virtual Cable
- VB-Audio Virtual Cable auto-install on first run (skipped if already present)
- Configurable `mic_sink`, `mic_capture_device`, `mic_buffer_packets`,
  and `mic_buffer_ms` settings in sunshine.conf
- `mic_buffer_packets` — jitter buffer prebuffer depth (default 2, range 1–16)
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
