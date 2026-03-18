<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">OpenCode Webserver mit einem Befehl als zuverlässigen systemd-Dienst einrichten.</p>
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

### Schnellstart

```bash
npx opencode-web-service setup
```

Der interaktive Assistent konfiguriert Port, Hostname, Arbeitsverzeichnis und Passwort und erstellt einen systemd-Dienst mit automatischem Start und Neustart bei Fehlern.

### Globale Installation

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `ocweb setup` | Interaktiver Einrichtungsassistent |
| `ocweb start` | Dienst starten |
| `ocweb stop` | Dienst stoppen |
| `ocweb restart` | Dienst neu starten |
| `ocweb status` | Dienststatus anzeigen (Status, PID, Laufzeit, URL) |
| `ocweb logs` | Protokolle anzeigen |
| `ocweb password` | Passwort ändern |
| `ocweb config` | Aktuelle Konfiguration anzeigen |
| `ocweb config set <key> <value>` | Einstellung ändern (port, hostname, workdir) |
| `ocweb upgrade` | OpenCode aktualisieren und Dienst neu starten |
| `ocweb upgrade --schedule "<cron>"` | Automatisches Upgrade über systemd Timer |
| `ocweb uninstall` | Dienst und alle Konfigurationen entfernen |


## Befehlsbeispiele

Diese Befehle decken den typischen End-to-End-Ablauf des CLI ab:

```bash
ocweb setup
ocweb start
ocweb status
ocweb logs
ocweb password
ocweb config
ocweb config set port 5000
ocweb restart
ocweb stop
ocweb upgrade
ocweb upgrade --schedule "0 3 * * *"
ocweb uninstall
```

---

## Sicherheit

- **Passwort erforderlich** — Komplexitätsprüfung bei der Einrichtung (8+ Zeichen, Ziffer, Sonderzeichen)
- **Geschützte lokale Zugangsdaten** — `~/.config/ocweb/env` wird mit `600`-Rechten geschrieben, und die Konfigurationsmetadaten speichern zusätzlich einen scrypt-Passworthash
- **0.0.0.0-Schutz** — bei Bindung an alle Interfaces wird Authentifizierung erzwungen

> [!CAUTION]
> Bei `--hostname 0.0.0.0` ist der Server aus dem Netzwerk erreichbar. Verwenden Sie Tailscale oder ngrok für sicheren Fernzugriff.

---

## Fernzugriff

**Tailscale (empfohlen)**
```bash
# Installation: https://tailscale.com
# Zugriff: http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## Automatisches Upgrade

```bash
# Täglich um 03:00 Uhr
ocweb upgrade --schedule "0 3 * * *"

# Jeden Sonntag um 02:00 Uhr
ocweb upgrade --schedule "0 2 * * 0"
```

---

## Voraussetzungen

- **Linux** mit systemd 245+ (Ubuntu 20.04+, Debian 11+, Fedora 33+, Arch)
- **Node.js** 18+
- **OpenCode** installiert und authentifiziert ([opencode.ai](https://opencode.ai))

---

## Haftungsausschluss

Dieses Projekt wurde nicht vom OpenCode-Team erstellt und ist nicht mit [OpenCode](https://opencode.ai) verbunden.

## Lizenz

[MIT](LICENSE)
