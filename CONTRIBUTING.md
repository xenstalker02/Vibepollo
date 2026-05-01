# Contributing to Vibepollo

## Building from Source

### Prerequisites

- **MSYS2** with UCRT64 environment ([msys2.org](https://www.msys2.org/))
- Install build dependencies in UCRT64 shell:

```bash
pacman -S mingw-w64-ucrt-x86_64-cmake \
          mingw-w64-ucrt-x86_64-ninja \
          mingw-w64-ucrt-x86_64-gcc \
          mingw-w64-ucrt-x86_64-boost \
          mingw-w64-ucrt-x86_64-openssl \
          mingw-w64-ucrt-x86_64-opus \
          mingw-w64-ucrt-x86_64-curl \
          mingw-w64-ucrt-x86_64-nlohmann-json \
          mingw-w64-ucrt-x86_64-miniupnpc \
          mingw-w64-ucrt-x86_64-cppwinrt
```

### Build Steps

```bash
# Clone the repository
git clone https://github.com/xenstalker02/Vibepollo.git
cd Vibepollo

# Configure (from UCRT64 shell)
mkdir -p build && cd build
cmake -G Ninja ..

# Build
ninja sunshine
```

### Build Troubleshooting

- If `sunshine.exe` is locked by a running process, stop it first (`taskkill /F /IM sunshine.exe`)
- Ensure you are using the UCRT64 shell, not MSYS or MINGW64
- If CMake cannot find dependencies, verify they are installed in the UCRT64 prefix

## Branch Strategy

- **master** — stable, release-ready code

All pull requests should target **master**.

## Syncing Upstream

Vibepollo is a fork. To sync with upstream changes:

```bash
git remote add upstream https://github.com/Nonary/vibepollo.git
git fetch upstream
git merge upstream/master
```

Resolve any conflicts, paying special attention to mic passthrough code paths that may not exist upstream.

## Pull Request Guidelines

1. Keep PRs focused on a single change or feature.
2. Include a clear description of what changed and why.
3. Test your changes locally (build and run).
4. For mic passthrough changes, test with a Vibelight client if possible.
5. Run a privacy scan before submitting: ensure no personal IPs, passwords, MAC addresses, or hostnames are included.

## What NOT to Commit

The following files contain personal or machine-specific data and must never be committed:

- `build/config/sunshine.conf` (personal configuration)
- `build/config/apps.json` (personal app list)
- `build/config/covers/` (personal cover images)
- `build/config/credentials/` (TLS certificates and keys)
- `fix_apps.ps1`, `cleanup_apollo.ps1`, `cleanup_vibepollo.ps1`, `fix_firewall.ps1` (local automation scripts)
- `watchdog.vbs` (local watchdog script)
- Any file containing IP addresses, passwords, MAC addresses, or hostnames

## Code Style

- Follow the existing code style in each file.
- Use `BOOST_LOG` for all logging with appropriate levels (verbose, debug, info, warning, error).
- Prefix mic-related log messages with `[mic]` for easy filtering.
- Use `using namespace std::literals` for string view literals (`"text"sv`).
