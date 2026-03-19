# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.1.0] — 2026-03-19

### Added

- **Ngrok tunnel mode** — optional access via ngrok for HTTP/2 + TLS, bypassing browser connection limits
  - `tunnel-server.js` entry point: spawns `opencode web` + `ngrok.forward()` with graceful shutdown
  - Setup wizard: mode selection (`local` / `ngrok`), authtoken prompt with reuse on reconfigure
  - Credential reuse: offers to keep existing username/password when reconfiguring
  - Shows ngrok public URL after setup (reads journal with retry)
  - `generateTunnelUnit()` for systemd service running tunnel-server.js
  - `@ngrok/ngrok` as optional dependency
- **Publish command** (`ocweb publish`) — automates npm release workflow
  - Pre-flight checks: auth, tests, dry-run
  - Version bumps, tag selection, confirmation prompt
  - Trusted Publishers support with `.env` token loading
- **CLI core** with interactive setup wizard
  - `ocweb setup` — guided configuration with systemd unit generation
  - `ocweb start | stop | restart` — service management
  - `ocweb status` — service status with uptime, PID, health warnings
  - `ocweb logs` — journalctl viewer with `--lines`, `--follow`, `--since` flags
  - `ocweb password` — password change with complexity validation
  - `ocweb config set|view` — runtime configuration management
  - `ocweb upgrade` — manual + scheduled upgrades with cron-to-systemd timer
  - `ocweb uninstall` — clean removal of service, timer, and config
- **README translations** — de, es, fr, ja, ko, ru, uk, zh

### Security

- Password hashing with scrypt (salt:hash format)
- Environment files created with mode `0600`
- Password never stored in config (only hash)
- Input validation on all prompts (port range, password complexity, path existence)

### Reliability

- Robust error handling across all commands
- Extended cron parser with step (`*/N`), range (`N-M`), and list (`N,M,K`) expressions
- Graceful degradation when systemd commands fail

### Fixed

- Correct repository URL to `pnetcloud/opencode-web-service`
