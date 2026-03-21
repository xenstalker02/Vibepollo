# Acknowledgments

Vibepollo is built on the work of many open source contributors.

## Direct Upstream
- **[Nonary/vibepollo](https://github.com/Nonary/vibepollo)** -- direct upstream fork
- **[ClassicOldSong/Apollo](https://github.com/ClassicOldSong/Apollo)** -- Apollo upstream
- **[LizardByte/Sunshine](https://github.com/LizardByte/Sunshine)** -- Sunshine upstream

## Parallel Implementation Reference
- **[logabell/Apollo](https://github.com/logabell/Apollo)** -- independent server-side mic implementation.
  We adopted: Steam Streaming Microphone multi-field device matching, mic fallback priority chain.
- **[logabell/moonlight-qt-mic](https://github.com/logabell/moonlight-qt-mic)** -- independent client-side mic implementation.
  We adopted: Opus encoder settings (64 kbps, FEC, VBR, complexity 10), deadline-based send pacer with re-sync guard, 12-frame buffer overflow cap, named-device-to-default fallback, `OPUS_FRAMESIZE_20_MS` explicit frame duration.

## Note on Parallel Development
Both this project and logabell's forks independently implemented mic passthrough for Moonlight/Sunshine. We cross-referenced implementations and adopted the strongest patterns from each.

Key design decisions in our implementation:
- Mic data rides the existing encrypted control stream (AES-GCM via SS_ENC_CONTROL_V2); plaintext mic is refused at the server, satisfying ClassicOldSong's upstream requirement
- Per-session Opus decoder (no shared global state — concurrent sessions are safe)
- Session routing by control stream context (not UDP IP matching — NAT-safe by design)

We encourage collaboration — reach out via GitHub Discussions or Issues.
