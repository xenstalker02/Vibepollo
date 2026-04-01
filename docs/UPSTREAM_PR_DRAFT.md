<!-- ⚠️ DO NOT OPEN THIS PR YET — complete E2E test and installer first -->

# feat: encrypted client mic passthrough via Steam Streaming Microphone

## Summary
Adds bidirectional mic passthrough from Moonlight/Vibelight client (Steam Deck) to Windows host
via Steam Streaming Microphone. Satisfies ClassicOldSong's stated requirements:

✅ **Encrypted mic stream** — mic data rides the AES-GCM encrypted control stream (SS_ENC_CONTROL_V2); plaintext mic is refused
✅ **Steam Streaming Microphone** — no VB-Cable required; auto-installs from local Steam
✅ **Per-session decoder** — concurrent session safe (no shared global state)
✅ **IP+port routing** — N/A to our 0x3003 approach (session context passed directly from control stream handler)

## Implementation
- **Protocol**: 0x3003 packet on existing control stream — no new ports, no firewall changes
- **Encryption**: mic data is AES-GCM encrypted as part of SS_ENC_CONTROL_V2; unencrypted sessions refused
- **Codec**: Opus 64 kbps, VBR, complexity 10, FEC enabled, DTX disabled, 20ms frames
- **Client capture**: SDL2 at 48kHz, deadline-based 20ms pacer with re-sync guard, 12-frame buffer cap
- **Server render**: WASAPI to Steam Streaming Microphone (primary) or VB-Cable (fallback)
- **Config options**: mic_sink, mic_capture_device, mic_buffer_ms, mic_buffer_packets in sunshine.conf

## Files Changed
- `src/stream.cpp` -- 0x3003 packet handler, mic render thread lifecycle
- `src/platform/windows/audio.cpp` -- WASAPI render, Steam mic 3-field matching, VB-Cable fallback
- `src/config.h` / `src/config.cpp` -- mic configuration options
- `sunshine.conf.template` -- documented configuration reference

## Testing
- Steam Deck AT2040 mic -> Windows host via LAN (1Gbps)
- Steam Deck mic -> Windows host via Tailscale (remote/AWAY path)
- Mic confirmed working in Discord, Windows Voice Recorder, game voice chat

## Credits
Implemented in parallel with logabell's work. Adopted Opus tuning, Steam mic approach,
and deadline pacer from logabell/Apollo and logabell/moonlight-qt-mic after comparing implementations.
See also: PR #1428 by logabell (https://github.com/ClassicOldSong/Apollo/pull/1428).

Note for ClassicOldSong: We are aware of and have followed PR #1428 closely. We recommend
reviewing both implementations together and are happy to collaborate or combine PRs.
