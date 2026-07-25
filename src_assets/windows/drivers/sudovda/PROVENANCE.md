# SudoVDA driver artifacts — provenance

Vibepollo installs the SudoVDA virtual-display driver on demand: `sunshine.exe` runs
`install.ps1` from this directory when a virtual display is first needed. That script
requires **both** binaries below. If either is missing or a stub, virtual-display support
fails at runtime — so the packaging step (`cmake/packaging/windows.cmake`) validates that
each `.dll`/`.exe` here is a real PE image, not just non-empty.

## `nefconc.exe` — tracked in this repo

Driver installation helper (creates the device node, installs the INF).

| | |
|---|---|
| Upstream | [nefarius/nefcon](https://github.com/nefarius/nefcon) |
| Release | `v1.17.40` (published 2026-03-05) |
| Asset | `nefcon_v1.17.40.zip` → `x64/nefconc.exe` |
| Size | 861,664 bytes |
| SHA-256 | `dd5d6ee28800a328bae8cdfc3809d38e47e10eb7755d1845255ca9067a32dd0a` |
| Authenticode | Valid — `CN=Nefarius Software Solutions e.U.` (DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1) |
| License | MIT |

To update: download the release asset over HTTPS, extract `x64/nefconc.exe`, verify the
Authenticode signature (`Get-AuthenticodeSignature`) and record the new size/SHA-256 here.

## `SudoVDA.dll` — **not tracked** (see `.gitignore`)

The virtual-display driver binary itself, covered by the signed catalog `sudovda.cat` in
this directory. It is deliberately not committed, so a fresh clone must supply it before
building an installer — the packaging step fails loudly if it is absent.

| | |
|---|---|
| Upstream | SudoMaker SudoVDA, as bundled by [ClassicOldSong/Apollo](https://github.com/ClassicOldSong/Apollo) |
| Known-good size | 83,216 bytes |
| Known-good SHA-256 | `47ee263cb5de9382c6630a2d7f3dafec4a49419f953beec869ca5dd0c460ff63` |

The hash above is the copy currently installed and running on the maintainer's host,
recovered from the Windows DriverStore
(`%SystemRoot%\System32\DriverStore\FileRepository\sudovda.inf_amd64_*\SudoVDA.dll`).
That is also the simplest recovery path on a machine where the driver is already installed.

**The DLL must match `sudovda.cat`.** The catalog signs the driver package; a mismatched
DLL will fail Windows' signature check at install time even though the build succeeds.
