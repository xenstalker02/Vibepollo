<!-- DO NOT OPEN THIS PR YET -- complete E2E test and installer first -->

# feat: client mic passthrough via control stream with WASAPI render and Steam Streaming Microphone

## Summary
Adds bidirectional mic passthrough: the Vibelight client (Steam Deck) captures mic audio,
Opus-encodes it (64 kbps, FEC, VBR, 20ms frames), and transmits it to Vibepollo (Windows host)
which renders it via Steam Streaming Microphone (primary) or VB-Cable (fallback) -- making the
Steam Deck microphone available to Windows applications during a streaming session.

## Implementation
- **Protocol**: 0x3003 packet on existing control stream -- no new ports, no firewall changes
- **Codec**: Opus 64 kbps, VBR, complexity 10, FEC enabled, DTX disabled, 20ms frames
- **Client capture**: SDL2 at 48kHz, deadline-based 20ms pacer with re-sync guard, 12-frame buffer cap
- **Server render**: WASAPI to Steam Streaming Microphone or VB-Cable
- **Config options**: mic_sink, mic_capture_device, mic_buffer_ms, mic_bitrate in sunshine.conf

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
- logabell/Apollo and logabell/moonlight-qt-mic for Opus tuning reference and
  Steam Streaming Mic multi-field matching pattern comparison.
