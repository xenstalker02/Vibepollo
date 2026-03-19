# Upstream Sync Guide

Vibepollo is a fork of [Nonary/vibepollo](https://github.com/Nonary/vibepollo).

## Automated Sync
A GitHub Actions workflow runs every Monday and opens an issue if new upstream commits exist.
Check for the `upstream-sync` label in Issues.

## Our changes (on top of upstream)

All mic passthrough functionality lives in:
- `src/stream.cpp` — 0x3003 packet handler, mic render thread, session teardown
- `src/platform/windows/audio.cpp` — WASAPI mic render client, VB-Cable version logging
- `src/config.h` / `src/config.cpp` — mic_sink, mic_capture_device, mic_buffer_ms config options
- `src/update.cpp` / `src/update.h` — auto-update targeting xenstalker02/Vibepollo
- `src/main.cpp` — log rotation, first-run browser launch
- `cmake/targets/common.cmake` — WIN32 subsystem (no console window)
- `cmake/targets/windows.cmake` — version.lib link
- `cmake/packaging/windows.cmake` — MSYS2 zlib1.dll path fallback
- `cmake/prep/build_version.cmake` — repo owner/name for update checks

## Current fork state

- Fork base: `23fe76a80e70a8db92474d148feb0faeb08223dd`
- Our additions (oldest → newest):
  ```
  56d3a4e7 feat: mic passthrough - client sends Opus audio via 0x3003, host decodes to VB-Cable
  4ba28b5f fix: elevate VB-Cable installer via user admin token when running as SYSTEM service
  977eedff fix: run VB-Cable installer directly without -Verb RunAs (elevation provided by C++ layer)
  2493bd5d feat: bundle VB-Cable installer instead of downloading at runtime
  7e61f0a8 fix: install VB-Cable via pnputil /add-driver instead of setup exe
  5133fe35 feat: mic audio buffer fix, auto-update, non-hardcoded device config, README
  22e63e0e feat: WIN32 tray-only mode, log rotation, first-run UX, VB-Cable version, changelogs
  ```

## How to sync upstream changes

When Nonary releases a new version:

```bash
# Fetch latest upstream
git fetch upstream

# Check what changed
git log upstream/master ^origin/master --oneline

# Create a merge branch
git checkout -b merge-upstream-YYYY-MM-DD
git merge upstream/master

# Resolve any conflicts — our mic passthrough files take priority
# If conflicts in the files listed above, keep OUR version

# Test the build
cd build
ninja sunshine

# If tests pass, merge back to master
git checkout master
git merge merge-upstream-YYYY-MM-DD
git push

# Clean up
git branch -d merge-upstream-YYYY-MM-DD
```

## Conflicts to watch for

These files frequently change upstream and may conflict with our changes:

- `src/stream.cpp` — any changes near the control stream packet handlers
- `src/platform/windows/audio.cpp` — any audio changes
- `src/config.h` / `src/config.cpp` — any new config options

When resolving conflicts in these files:
1. Keep Nonary's new features and fixes
2. Keep ALL of our mic passthrough additions
3. Never remove the 0x3003 handler, mic render client, or WASAPI write path
