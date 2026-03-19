<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">Run OpenCode web server as a reliable systemd service with one command.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/opencode-web-service"><img alt="npm" src="https://img.shields.io/npm/v/opencode-web-service?style=flat-square" /></a>
  <img alt="license" src="https://img.shields.io/npm/l/opencode-web-service?style=flat-square" />
  <img alt="node" src="https://img.shields.io/node/v/opencode-web-service?style=flat-square" />
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.fr.md">Français</a>
</p>

---

### Quick Start

```bash
npx opencode-web-service setup
```

That's it. The interactive wizard will configure port, hostname, working directory, and password — then create a systemd service that auto-starts on boot and restarts on failure.

### Install Globally

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## Commands

| Command | Description |
|---------|-------------|
| `ocweb setup` | Interactive setup wizard |
| `ocweb start` | Start the service |
| `ocweb stop` | Stop the service |
| `ocweb restart` | Restart the service |
| `ocweb status` | Show service status (state, PID, uptime, URL) |
| `ocweb doctor` | Check dependencies and service health |
| `ocweb logs` | Show service logs |
| `ocweb password` | Change password |
| `ocweb config` | Show current configuration |
| `ocweb config set <key> <value>` | Update a setting (port, hostname, workdir, username) |
| `ocweb upgrade` | Upgrade OpenCode & restart service |
| `ocweb upgrade --schedule "<cron>"` | Set up auto-upgrade via systemd timer |
| `ocweb uninstall` | Remove service, config, and all related files |


## Command Examples

Use the CLI end to end with these common flows:

```bash
ocweb setup
ocweb start
ocweb status
ocweb doctor
ocweb logs
ocweb password
ocweb config
ocweb config set port 5000
ocweb config set username admin
ocweb restart
ocweb stop
ocweb upgrade
ocweb upgrade --schedule "0 3 * * *"
ocweb uninstall
```

---

## Non-Interactive Setup

Use flags when you want a scripted install:

```bash
ocweb setup --mode local --port 4096 --hostname localhost --workdir "$HOME" --username opencode --password 'StrongPass1!'

ocweb setup --mode ngrok --port 4096 --workdir "$HOME" --username opencode --password 'StrongPass1!' --ngrok-authtoken 'token_here'
```

If the service is already configured, add `--force` to overwrite it non-interactively.

---

## Security

- **Password required** — enforced during setup with complexity validation (8+ chars, digit, special character)
- **Protected local credentials** — `~/.config/ocweb/env` is written with `600` permissions, and config metadata stores a scrypt password hash
- **0.0.0.0 protection** — binding to all interfaces forces authentication, shows warning

> [!CAUTION]
> When using `--hostname 0.0.0.0`, the server is accessible from the network. Use Tailscale or ngrok for secure remote access.

---

## Remote Access

For secure access from phone, tablet, or another machine:

**Tailscale (recommended)**
```bash
# Install: https://tailscale.com
# Access: http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## Auto-Upgrades

```bash
# Daily at 3:00 AM
ocweb upgrade --schedule "0 3 * * *"

# Weekly on Sunday at 2:00 AM
ocweb upgrade --schedule "0 2 * * 0"
```

Uses systemd timer — no cron needed.

---

## Requirements

- **Linux** with systemd 245+ (Ubuntu 20.04+, Debian 11+, Fedora 33+, Arch)
- **Node.js** 22+
- **OpenCode** installed and authenticated ([opencode.ai](https://opencode.ai))

---

## How It Works

`ocweb setup` creates:

| File | Purpose |
|------|---------|
| `~/.config/systemd/user/ocweb.service` | systemd user unit (auto-restart, auto-start) |
| `~/.config/ocweb/env` | Environment file with credentials (mode 600) |
| `~/.config/ocweb/config.json` | CLI configuration |

The service runs `opencode web --port <port> --hostname <hostname>` under your user account with lingering enabled.

---

## Troubleshooting

**Service won't start**
```bash
ocweb doctor         # Check dependencies and config health
ocweb logs           # Check logs
which opencode       # Verify OpenCode is installed
```

**Port already in use**
```bash
lsof -i :4096
ocweb config set port 4096
```

**Can't connect remotely**
1. Check `ocweb status` — service must be active
2. Verify hostname is `0.0.0.0` (not `localhost`)
3. Check firewall rules

---

## Disclaimer

This project is not built by the OpenCode team and is not affiliated with [OpenCode](https://opencode.ai) in any way.

## License

[MIT](LICENSE)
