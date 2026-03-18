# Vibepollo Troubleshooting Guide

## 1. Mic not switching to CABLE Output on session start

**Symptom:** Host apps (Discord, etc.) don't hear the client's microphone during a stream.

**Fix:** Ensure `mic_sink` is set in your `sunshine.conf`:
```
mic_sink = CABLE Input
mic_capture_device = CABLE Output (VB-Audio Virtual Cable)
```
Check the Vibepollo log for `[mic] Mic passthrough active` to confirm it initialized.

## 2. VB-Cable not found / install failed

**Symptom:** Log shows mic passthrough disabled, VB-Cable devices not visible in Windows Sound settings.

**Fix:**
- Download VB-Cable manually from [vb-audio.com/Cable](https://vb-audio.com/Cable/)
- Run the installer **as Administrator**
- Reboot after installation
- Verify CABLE Input and CABLE Output appear in Sound settings

## 3. Stream connects but no mic audio on PC

**Symptom:** Stream works, but host applications don't receive mic audio.

**Fix:**
- Verify `mic_capture_device` in `sunshine.conf` matches the exact name shown in Windows Sound settings
- Check the log at startup for `[mic] WARNING: mic_capture_device 'X' not found` — this lists available devices
- Ensure the client (Vibelight/Moonlight) has mic passthrough enabled

## 4. WASAPI error in logs

**Symptom:** Log shows `[mic] WASAPI device invalidated` or `AUDCLNT_E_DEVICE_INVALIDATED`.

**Fix:** This occurs when the audio device disappears mid-session (e.g., USB device unplugged, driver reset). Vibepollo will disable mic rendering for the current session. Reconnect the device and start a new session.

## 5. Firewall blocking stream / "control stream establishment failed error 11"

**Symptom:** Client connects but stream fails to start, or mic data doesn't flow.

**Fix:**
- Add an inbound firewall rule for UDP port **47999**
- Also ensure TCP ports **47984-47990** and UDP ports **47998-48010** are open
- In Windows Defender Firewall: create a new inbound rule for `sunshine.exe` allowing all traffic

## 6. UUID mismatch / client won't pair

**Symptom:** Previously paired client can no longer connect; pairing fails silently.

**Fix:**
- Check `uniqueid` in `sunshine_state.json` (in the config directory)
- The client stores the host's UUID; if it changes, the client must re-pair
- Do not modify `uniqueid` unless you intend to break existing pairings

## 7. Web UI not reachable at localhost:47990

**Symptom:** Browser shows connection refused or timeout when accessing `https://localhost:47990`.

**Fix:**
- Verify Vibepollo is actually running (check Task Manager for `sunshine.exe`)
- Check Windows Defender or antivirus isn't blocking the process
- Try `https://127.0.0.1:47990` instead
- Check logs for startup errors

## 8. Auto-update pulling wrong repo

**Symptom:** Updates install upstream Sunshine/Apollo instead of Vibepollo.

**Fix:**
- Verify `build_version.cmake` references `xenstalker02/Vibepollo`
- The update URL must **never** point to `Nonary/vibepollo`
- If wrong, manually download the correct release from the Vibepollo GitHub

## 9. Console window appearing on launch

**Symptom:** A black console window appears when running sunshine.exe.

**Fix:**
- Use the provided `Launch.bat` to start Vibepollo without a console window
- Or use PowerShell: `Start-Process sunshine.exe -WindowStyle Hidden`
- When running as a service, no console window will appear

## 10. mic_sink / mic_capture_device not matching any device

**Symptom:** Log shows `[mic] WARNING: mic_capture_device 'X' not found. Available devices: [...]`.

**Fix:**
- Open VB-Cable Audio Panel or Windows Sound settings to find the exact device names
- Copy the exact device name (including parenthetical text) into your `sunshine.conf`
- Common names: `CABLE Input` for mic_sink, `CABLE Output (VB-Audio Virtual Cable)` for mic_capture_device
- After changing the config, restart Vibepollo
