# Changelog

## [1.15.19] — 2026-06-30

### Fixed
- **Host now sleeps after a client *disconnects*, not just on full quit (completes 1.15.18).**
  A normal last-client disconnect pauses the app rather than terminating it, so the
  1.15.18 release (which only ran on `terminate`) could leave the SudoVDA driver held open
  after a disconnect. The release is now centralized in `release_idle_vdisplay()` (gated on
  "not headless AND no active stream session") and also invoked from the virtual-display
  cleanup path, so the driver is released on terminate, disconnect, and paused-then-reverted
  sessions alike — and never while another client is still streaming (multi-client safe).
  (Found by a Codex review of the 1.15.18 change.)

## [1.15.18] — 2026-06-30

### Fixed
- **Host now sleeps between streams too, not just at idle (completes the 1.15.17 fix).**
  After a stream ends, Vibepollo releases the SudoVDA virtual-display driver (closes the
  device handle and stops its ping/watchdog thread) when the host has a physical display,
  so the indirect-display adapter goes idle and the system can enter S3 sleep whenever no
  client is actively streaming. The driver is reopened on demand at the next stream, so
  virtual-display streaming (monitors off + virtual display on) is unchanged. Headless
  hosts keep the driver open as before.

## [1.15.17] — 2026-06-29

### Fixed
- **Host could not enter S3 sleep while idle (real fix).** On a host with physical
  monitors, the apps-refresh path pre-opened the SudoVDA virtual-display driver at
  startup and held it open for the whole process lifetime (device handle + ping/
  watchdog thread), keeping the indirect-display adapter active — which blocks system
  sleep while letting the monitors power off. The pre-open is now gated on
  `should_auto_enable_virtual_display()` (no physical display), mirroring the existing
  startup gate; with monitors present the driver is opened on demand at stream start,
  so the host sleeps when idle and virtual-display streaming is unchanged. (The 1.15.16
  `ES_DISPLAY_REQUIRED` change was a related-but-wrong target and did not fix this.)

## [1.15.16] — 2026-06-29

### Fixed
- **Host could not enter sleep while idle.** When no stream was active, an internal
  display/encoder probe could assert a one-shot display-wake hint that silently reset
  the system idle-sleep timer (it never appeared in `powercfg /requests`), preventing
  the PC from ever sleeping. The wake hint is now asserted only while a stream is
  active, so the host sleeps normally when idle. Mid-stream keep-awake is unchanged.

## [1.15.15] — 2026-06-16

### Added
- **Per-application mic passthrough overrides.** The mic passthrough sink and
  capture device can now be overridden per app (App → Add Setting Overrides →
  Audio/Video), so a specific title can use different mic devices than the global
  default.

### Fixed
- **Steam Big Picture / `steam://` shortcuts launch reliably.** Per-app `steam://`
  commands (e.g. a Big Picture launcher) now open correctly instead of falling
  through to the desktop. Set the command as a bare URL such as
  `steam://open/bigpicture`.
- **Hardened session teardown.** If the display helper became unavailable
  mid-session, teardown could hang and trip the watchdog. Teardown is now bounded
  and self-heals.

### Changed
- **Streamlined the Audio / Video settings.** The Mic Passthrough section lost its
  redundant header (each field is self-describing), and the device-name field now
  shows this PC's hostname as the placeholder instead of an internal default.

### Security
- Updated web UI dependencies (axios, vite) to clear known advisories.

## [1.15.14] — 2026-06-12

### Fixed
- **Post-stream crash / session hang.** The display helper could wedge after a
  stream ended, and repeated relaunch attempts could trip the session hang
  watchdog and abort. Added a failure cooldown, adopt-an-existing-helper on
  launch contention, and a fix for the underlying cause — a process-launch flag
  (`CREATE_BREAKAWAY_FROM_JOB`) that failed when Vibepollo runs under a Windows
  scheduled-task job. Teardown is now fast and crash-free.
- **Mic passthrough reliability.** Mic redirect now initializes on the first mic
  packet, so clients that don't send mic audio never touch host capture state. It
  also self-heals: if the *Speakers (Steam Streaming Microphone)* render endpoint
  has been disabled in Windows, Vibepollo re-enables it automatically instead of
  silently failing.
- **Default audio device restored after streams.** If a stream leaves a virtual
  Steam streaming device as the Windows default playback device, the previous
  default is restored on session end and at startup.

### Added
- **Mic Passthrough status card** in the Web UI Troubleshooting tab — live status
  (configured / awaiting session / active) plus a one-click filter for mic logs.

### Changed
- Update notifications now check this fork's own releases.

## [1.15.11] — 2026-05-04

### Fixed
- **Tray NIM_DELETE orphan cleanup** — added `Shell_NotifyIcon(NIM_DELETE)` before
  `NIM_ADD` on tray re-init and on process exit. Eliminates ghost tray icons that
  required task-kill to clear after an elevated restart.

### Changed
- **Wizard images redesigned** — installer sidebar and header BMPs now match the
  Vibepollo/Vibelight banner art aesthetic: navy-indigo gradient background, orange
  glow accent top-right, teal glow bottom-left, transparent logo paste.

## [1.15.10] — 2026-05-03

### Fixed
- **Vibepollo now actually restarts after auto-update** — 1.15.9 removed `skipifsilent`
  from the schtasks [Run] entry but left `postinstall`, which means the entry only ran
  when the user clicked Finish on the wizard page — a page that never appears in `/SILENT`
  mode (used by auto-updates). Removed `postinstall` so the entry runs at the end of the
  install phase for all modes (interactive and silent alike). The browser-open step retains
  both `postinstall` and `skipifsilent`.

## [1.15.9] — 2026-05-03

### Fixed
- **Vibepollo restarts after auto-update** — removed `skipifsilent` from the
  `schtasks /run` step in the installer. Silent installs (auto-updates via the
  bootstrapper) now start Vibepollo when done. Previously the Task Scheduler
  launch was skipped in silent mode, leaving Vibepollo stopped after every
  auto-update. The "Open Web UI" step retains `skipifsilent` so the browser
  does not pop open on auto-updates.

## [1.15.8] — 2026-05-03

### Fixed
- **apps.json preserved on upgrade** — installer now pre-seeds `config/apps.json`
  with the default app list using `onlyifdoesntexist` semantics (same pattern as
  `sunshine.conf`). On fresh install the defaults are written; on upgrade the
  existing user app list is preserved. Previously, a fresh install path in
  `apply_config()` could overwrite user apps if the config file was absent.

## [1.15.7] — 2026-05-03

### Fixed
- **Tray "Open Vibepollo" now opens browser** — `open_url()` in `misc.cpp` was
  using `CreateProcessW("explorer.exe URL")` which inherits the elevated process
  token from Task Scheduler (RunLevel Highest). Browsers silently refuse elevated
  launches. Replaced with `ShellExecuteW` which routes through the shell's
  file-association system and correctly crosses the elevation boundary.
- **Web UI no longer auto-opens on every restart** — removed a first-run check in
  `main.cpp` that fired `ShellExecuteW` whenever `sunshine_state.json` was absent.
  Since that file stores only web UI credentials (not device pairing or settings),
  it was frequently absent, causing the browser to open on every tray restart.
  The tray "Open Vibepollo" button is the correct entry point.
- **apollo.ico → vibepollo.ico in bootstrapper** — `build_bootstrapper.ps1` was
  referencing the old `apollo.ico` path, breaking the uninstaller build step.

## [1.15.6] — 2026-05-02

### Fixed (2026-05-02 — Codex QC round 2)
- **mic_seq_order_t bounds guard** — `stream.cpp` now checks `delta` before
  inserting into `pending_packets`. Packets with `delta ≥ 32768` (outside the
  playout window) are dropped with a debug log rather than passed to
  `mic_seq_order_t`, preventing undefined behaviour from the comparator's
  strict-weak-ordering assumption when sequence numbers are exactly 32768 apart.
- **Stale WASAPI audio cleared on re-init** — `mic_write.cpp` now calls
  `pending_frames.clear()` under the queue mutex immediately after a successful
  WASAPI re-initialisation. Previously, audio queued before the device-lost event
  would replay into the fresh session, causing a burst of stale audio at reconnect.
- **Apollo → Vibepollo in fatal log** — `main.cpp` fatal message corrected from
  "Apollo" to "Vibepollo".

### Fixed (2026-05-02 — Installer)
- **assets/apps.json shipped** — installer now packages
  `src_assets/windows/assets/apps.json` to `{app}\assets\apps.json`. Previously
  absent; `apply_config()` threw `std::filesystem::filesystem_error` on first run
  because it tried to copy the file from a relative path that didn't exist, causing
  `config::parse` to return early with no log file created.
- **setup-task.ps1 sandboxed** — helper script is now extracted to a temp directory
  during installation and auto-deleted afterward. Never written to Program Files.
- **WASAPI startup block removed** — removed an `if (initialized) return;` guard
  that prevented WASAPI from reinitialising after a device-lost event. Was a latent
  `std::terminate()` risk if the audio device was reconnected mid-session.

## [1.15.5] — 2026-04-30

### Fixed
- **Two pre-existing compile errors resolved** — `platf::from_utf8` was called in
  `vibepollo_vmic.cpp` without including the header that declares it (`misc.h`);
  added the missing include. `SeqOrder` comparator struct was defined inside an
  anonymous struct member of `session_t`, making it inaccessible from lambdas at
  namespace scope; extracted and renamed to `mic_seq_order_t`, moved to
  `namespace stream` before `session_t`. Both errors blocked all builds since
  commit `3e29c293`.
- **WiX installer ComponentRef mismatch** — `patch_custom_actions.wxs` referenced
  `<ComponentRef Id="ApolloSvc"/>` but the component in `custom_actions.wxs` is
  `Id="VibepollSvc"`. Corrected to `VibepollSvc`; this would have caused installer
  builds to fail with an unresolved component reference.
- **Web UI broken i18n keys** — `troubleshooting.html` used `restart_apollo*` and
  `quit_apollo*` locale keys that were never defined in any locale file, causing
  raw key strings to render in the UI. Remapped to existing `restart_sunshine*`
  keys for the restart section; added new `stop_sunshine*` keys in `en.json` for
  the quit/stop section.
- **Default username artifact** — welcome.html pre-filled the new-user form with
  `newUsername: 'apollo'`; changed to `'vibepollo'`.

### Changed
- **Complete apollo→vibepollo asset rename** — all icon, image, CSS, and SVG files
  renamed from `apollo*` to `vibepollo*` (24 files) including root icons, tray
  icons, web UI images (`logo-apollo-45.png`, `apollo.ico`, `apollo-locked.*`,
  `apollo-playing.*`, `apollo-pausing.*`), and `assets/css/apollo.css`.
- **cmake and installer references updated** — all cmake packaging files
  (`linux.cmake`, `windows.cmake`, `windows_wix.cmake`, `targets/windows.cmake`),
  `vibepollo.iss`, and `compile_definitions/windows.cmake` updated to reference
  `vibepollo.*` icon assets.
- **System tray icon macros updated** — `TRAY_ICON`, `TRAY_ICON_PLAYING`,
  `TRAY_ICON_PAUSING`, `TRAY_ICON_LOCKED` macros and macOS logo paths in
  `system_tray.cpp` updated from `apollo*` to `vibepollo*`.
- **Tray menu "Open Apollo" → "Open Vibepollo"** — all three "Open Apollo"
  occurrences in `system_tray.cpp` corrected.
- **confighttp.cpp image routes updated** — `getApolloLogoImage` →
  `getVibepolloLogoImage`; route regex updated; legacy aliases added for
  `logo-apollo-45.png` and `logo-sunshine-45.png` backward compatibility.
- **Web UI logo references** — `App.vue`, `Login.vue`, `login.html`, and
  `welcome.html` updated from `logo-apollo-45.png` to `logo-vibepollo-45.png`.

## [1.15.4] — 2026-04-28

### Changed
- **VB-Cable fallback removed** — Steam Streaming Microphone is now the sole mic
  backend. VB-Audio Virtual Cable is no longer required or supported. Mic passthrough
  works out of the box via the Steam audio driver with no third-party software.
- **Web UI cleaned up** — all VB-Cable references removed from settings UI and locale
  strings. `mic_sink` placeholder updated to `Speakers (Steam Streaming Microphone)`.

### Merged
- Upstream Nonary/vibepollo 1.15.1-stable.1 (484bacaf): prep-cmd env-var fix,
  playnite autosynced entry dedup, tray service relaunch fix, steam audio restore fix,
  stream capture wait latency fix, playnite game focus fix, display SudoVDA watchdog fix,
  tray lifecycle serialization, nvenc runtime API fix, playnite focus target fix.

### Fixed (CI)
- Upstream-check workflow: `fetch-depth: 0` + `issues: write` permission added so
  weekly upstream diff runs correctly and can open GitHub issues.

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
