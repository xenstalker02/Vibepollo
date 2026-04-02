# Vibepollo Troubleshooting Guide

## 1. Mic passthrough not working on session start

**Symptom:** Host apps (Discord, etc.) don't pick up the client microphone.

**Step 1 — Check the log:**
```powershell
# Installed version:
Get-Content (Get-ChildItem "$env:PROGRAMDATA\Vibepollo\config\logs\sunshine-*.log" | Sort-Object LastWriteTime | Select-Object -Last 1).FullName | Select-String '\[mic\]' | Select-Object -First 20
# Build-from-source version:
Get-Content (Get-ChildItem "C:\Vibepollo\build\config\logs\sunshine-*.log" | Sort-Object LastWriteTime | Select-Object -Last 1).FullName | Select-String '\[mic\]' | Select-Object -First 20
```
Look for:
- `[mic] using Steam Streaming Microphone backend` — primary path working ✓
- `[mic] using VB-Cable fallback` — Steam unavailable, fallback used ✓
- `[mic] both Steam mic and VB-Cable backends failed` — neither found ✗
- `[mic] mic_sink not configured` — mic_sink missing from sunshine.conf ✗

**Step 2 — Verify sunshine.conf has the correct values:**
```
mic_sink = Speakers (Steam Streaming Microphone)
mic_capture_device = Microphone (Steam Streaming Microphone)
```
Or via Web UI at https://localhost:47990 → Configuration → Mic Passthrough section.

**Step 3 — If Steam mic unavailable:**
Ensure Steam is running before starting a stream. The Steam Streaming Microphone
endpoint is created by Steam's audio driver and only exists while Steam is running.

**Step 4 — If VB-Cable fallback also failed:**
Run the Vibepollo installer to auto-install VB-Audio CABLE, or download from
https://vb-audio.com/Cable/

**Step 5 — Verify Discord is using Default microphone:**
Discord → Settings → Voice & Video → Input Device → Default.
Vibepollo switches the Windows default capture device at session start.
Discord must be set to Default (not a specific device) to pick it up automatically.

## 2. Steam Streaming Microphone not found

**Symptom:** Log shows `[mic] apollo_vmic_t::init() failed — Steam Streaming Microphone unavailable`.

**Cause:** Steam is not running, or Steam's audio driver hasn't initialized yet.

**Fix:**
- Ensure Steam is running before starting a stream session.
- If Steam is running but the device still isn't found: open Windows Sound settings
  and verify "Speakers (Steam Streaming Microphone)" appears in Playback devices.
  If it doesn't, restart Steam.
- If it still doesn't appear: open Device Manager → Sound controllers and check for
  "Steam Streaming Microphone". If missing, reinstall Steam.
- Vibepollo automatically falls back to VB-Cable if Steam mic is unavailable — check
  the log for `[mic] using VB-Cable fallback` to confirm the fallback is working.

## 3. VB-Cable not found (fallback also unavailable)

**Symptom:** Log shows `[mic] both Steam mic and VB-Cable backends failed`.

**Fix:**
- Run the Vibepollo installer — it installs VB-Cable automatically.
- Or download manually from [vb-audio.com/Cable](https://vb-audio.com/Cable/),
  run the installer as Administrator, and reboot.
- Verify "CABLE Input" and "CABLE Output (VB-Audio Virtual Cable)" appear in
  Windows Sound settings after installation.

## 4. Stream connects but mic audio is silent

**Symptom:** Log shows `recv=0` — no packets received from client.

**Fix:**
- Verify Vibelight has mic passthrough enabled: Settings → "Send microphone to host PC"
- Verify the stream is using an encrypted control session. Check Vibepollo log for
  `[mic] no encrypted control stream` — if seen, the client is not negotiating
  encryption.
- Check that the Deck mic is not muted. In SteamOS Desktop Mode:
  `pactl get-source-mute @DEFAULT_SOURCE@` — should return `Mute: no`.

## 5. Mic audio reaches PC but sounds distorted or garbled

**Symptom:** `recv > 0`, `decoded > 0` in logs, but audio quality is poor.

**Fix:**
- Check PipeWire capture volume: `pactl get-source-volume @DEFAULT_SOURCE@`
  Should be around 50% (-18.06 dB). If it's at 100%, the built-in mic will
  overdrive the encoder. Reset: `pactl set-source-volume @DEFAULT_SOURCE@ 50%`
- Confirm downmix is active in log: look for `[mic] Opened ... 2ch` — PipeWire
  delivering stereo is normal and is handled by the downmix.
- If using an external mic at full gain, reduce via the mic bitrate slider.

## 6. Echo on stream audio

**Symptom:** People on the PC hear their own voice echoed back.

**Cause:** The Deck's built-in mic is physically near its speakers. Game audio
playing through the Deck speakers gets re-captured and sent back to the PC.

**Fix:** Use headphones or a headset on the Deck during any session where mic
passthrough is active. This is a hardware constraint, not a software issue.

## 7. Mic audio choppy or dropping

**Symptom:** `plc > 0` or `silence > 0` in log stats, or audible dropouts.

**Fix:**
- Increase `mic_buffer_packets` in sunshine.conf (default 2 = 40ms; try 3 or 4
  for unstable Wi-Fi). Change via Web UI or add `mic_buffer_packets = 4` to conf.
- Check network: on LAN this should never happen. On AWAY path (Tailscale), packet
  loss is expected and FEC is enabled to compensate.
- Verify PipeWire volume is at 50% (see item 5 above).

## 8. WASAPI render device lost mid-session

**Symptom:** Log shows `[mic] WASAPI render device lost — disabling mic for this session`.

**Fix:** This happens if the Steam audio driver resets mid-session (rare, usually
after a Steam update or Windows audio service restart). Reconnect the stream to
start a new session with a fresh WASAPI client.

## 9. Firewall blocking stream

**Symptom:** Client connects but stream fails, or "control stream establishment failed error 11".

**Fix:**
- TCP: 47984, 47989, 47990 — inbound
- UDP: 47998–48010 — inbound
The Vibepollo installer configures these automatically. If missing, run:
```
netsh advfirewall firewall add rule name="Vibepollo TCP" protocol=TCP dir=in localport=47984,47989,47990 action=allow
netsh advfirewall firewall add rule name="Vibepollo UDP" protocol=UDP dir=in localport=47998-48010 action=allow
```

## 10. UUID mismatch / client won't pair

**Symptom:** Previously paired client can no longer connect.

**Fix:** The client stores the host's UUID. If `sunshine_state.json` was regenerated
or its uniqueid changed, the client must re-pair. Do not modify the uniqueid.

## 11. No toast notifications on stream start/end

**Symptom:** No balloon notifications appear in the system tray.

**Fix:**
- Verify Vibepollo is showing a tray icon in the system tray (bottom-right taskbar).
  If no tray icon, tray initialization may have failed — check logs for
  "Failed to create system tray".
- Check Windows notification settings: Settings → System → Notifications → make
  sure notifications are enabled for sunshine.exe.
- If the tray icon is present but no toasts fire at all: this was a known
  bug fixed in Vibepollo 1.15.1. The root cause was the tray GUID being
  orphaned in the Windows Shell database after any unclean shutdown, causing
  tray initialization to fail silently on all 30 retry attempts. Upgrade to
  1.15.1 or later, or do a clean restart of Vibepollo (Stop-Service ApolloService
  first, then relaunch — this clears the orphaned GUID).

## 12. Web UI not reachable at localhost:47990

**Symptom:** Browser shows connection refused.

**Fix:**
- Verify sunshine.exe is running (check Task Manager).
- Try `https://127.0.0.1:47990` instead.
- Check that antivirus is not blocking sunshine.exe.
- Check logs for startup errors.

## 13. mic_sink or mic_capture_device name not matching

**Symptom:** Log shows `[mic] virtual_microphone: device not found: X` or
`[mic] switch_capture_to: device not found: X`.

**Fix:** The exact device name must match Windows Sound settings.
- Open Windows Sound settings → see the exact device name in parentheses.
- Common correct values:
  - `mic_sink = Speakers (Steam Streaming Microphone)`
  - `mic_capture_device = Microphone (Steam Streaming Microphone)`
  - VB-Cable fallback: `mic_sink = CABLE Input`
  - VB-Cable capture: `mic_capture_device = CABLE Output (VB-Audio Virtual Cable)`
