<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">Lancez le serveur web OpenCode en tant que service systemd fiable avec une seule commande.</p>
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

### Démarrage rapide

```bash
npx opencode-web-service setup
```

L'assistant interactif configurera le port, le nom d'hôte, le répertoire de travail et le mot de passe, puis créera un service systemd avec démarrage automatique et redémarrage en cas de défaillance.

### Installation globale

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## Commandes

| Commande | Description |
|----------|-------------|
| `ocweb setup` | Assistant de configuration interactif |
| `ocweb start` | Démarrer le service |
| `ocweb stop` | Arrêter le service |
| `ocweb restart` | Redémarrer le service |
| `ocweb status` | Afficher l'état du service (état, PID, durée, URL) |
| `ocweb logs` | Afficher les journaux |
| `ocweb password` | Changer le mot de passe |
| `ocweb config` | Afficher la configuration actuelle |
| `ocweb config set <key> <value>` | Modifier un paramètre (port, hostname, workdir) |
| `ocweb upgrade` | Mettre à jour OpenCode et redémarrer le service |
| `ocweb upgrade --schedule "<cron>"` | Mise à jour automatique via systemd timer |
| `ocweb uninstall` | Supprimer le service et toute la configuration |


## Exemples de commandes

Ces commandes couvrent le flux d'utilisation complet du CLI :

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

## Sécurité

- **Mot de passe obligatoire** — validation de complexité lors de l'installation (8+ caractères, chiffre, caractère spécial)
- **Identifiants locaux protégés** — `~/.config/ocweb/env` est écrit avec les permissions `600`, et les métadonnées de configuration conservent aussi un hash scrypt du mot de passe
- **Protection 0.0.0.0** — lors de la liaison à toutes les interfaces, l'authentification est forcée

> [!CAUTION]
> Avec `--hostname 0.0.0.0`, le serveur est accessible depuis le réseau. Utilisez Tailscale ou ngrok pour un accès distant sécurisé.

---

## Accès distant

**Tailscale (recommandé)**
```bash
# Installation : https://tailscale.com
# Accès : http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## Mise à jour automatique

```bash
# Quotidiennement à 03h00
ocweb upgrade --schedule "0 3 * * *"

# Chaque dimanche à 02h00
ocweb upgrade --schedule "0 2 * * 0"
```

---

## Prérequis

- **Linux** avec systemd 245+ (Ubuntu 20.04+, Debian 11+, Fedora 33+, Arch)
- **Node.js** 18+
- **OpenCode** installé et authentifié ([opencode.ai](https://opencode.ai))

---

## Avertissement

Ce projet n'est pas créé par l'équipe OpenCode et n'est pas affilié à [OpenCode](https://opencode.ai).

## Licence

[MIT](LICENSE)
