# Upstream Sync Guide

Vibepollo is a fork of [Nonary/vibepollo](https://github.com/Nonary/vibepollo).

## Automated Sync
A GitHub Actions workflow (`upstream-check.yml`) runs every Monday at 9am UTC
and opens a GitHub issue if Nonary has pushed new commits. You will receive
a GitHub email notification when this triggers.

## Our additions (protected files — always keep our version on merge)

All mic passthrough functionality lives in:
- `src/platform/windows/mic_write.cpp` + `mic_write.h` — our files, Nonary doesn't have these
- `src/platform/windows/apollo_vmic.cpp` + `apollo_vmic.h` — our files, Nonary doesn't have these
- `src/platform/windows/audio.cpp` — our WASAPI mic render, virtual_microphone, capture snapshot/restore
- `src/stream.cpp` — our 0x3003 IDX_MIC_AUDIO_DATA handler and mic session lifecycle
- `src/config.h` + `src/config.cpp` — our mic_sink, mic_capture_device, mic_buffer_ms, mic_buffer_packets
- `src/system_tray.cpp` — our toast dedup logic with 30s gap reset
- `src/update.cpp` + `src/update.h` — auto-update targeting xenstalker02/Vibepollo (not Nonary)

All other files: take Nonary's version.

## How to merge when an upstream issue opens

```bash
cd C:\Vibepollo
git fetch upstream
git log HEAD..upstream/master --oneline --no-merges   # see what changed
git merge upstream/master
```

If conflicts occur in protected files, always keep our version:
```bash
git checkout HEAD -- src/platform/windows/audio.cpp
git checkout HEAD -- src/platform/windows/mic_write.cpp
git checkout HEAD -- src/platform/windows/mic_write.h
git checkout HEAD -- src/platform/windows/apollo_vmic.cpp
git checkout HEAD -- src/platform/windows/apollo_vmic.h
git checkout HEAD -- src/stream.cpp
git checkout HEAD -- src/config.h
git checkout HEAD -- src/config.cpp
git checkout HEAD -- src/system_tray.cpp
git checkout HEAD -- src/update.cpp
git checkout HEAD -- src/update.h
```

Then build, privacy scan, commit, push.

## Conflict files to watch (frequently change upstream)
- `src/stream.cpp` — changes near control stream packet handlers
- `src/platform/windows/audio.cpp` — any audio changes
- `src/config.h` / `src/config.cpp` — new config options

## Current state
- Upstream base: Nonary 1.15.0-stable.2
- Our fork: xenstalker02/Vibepollo — see CHANGELOG.md for our additions
