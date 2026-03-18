<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">Запуск OpenCode веб-сервера як надійної systemd-служби однією командою.</p>
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

### Швидкий старт

```bash
npx opencode-web-service setup
```

Інтерактивний візард налаштує порт, hostname, робочу директорію та пароль — потім створить systemd-службу з автозапуском та авторестартом при збоях.

### Глобальне встановлення

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## Команди

| Команда | Опис |
|---------|------|
| `ocweb setup` | Інтерактивний візард налаштування |
| `ocweb start` | Запустити службу |
| `ocweb stop` | Зупинити службу |
| `ocweb restart` | Перезапустити службу |
| `ocweb status` | Статус (стан, PID, uptime, URL) |
| `ocweb logs` | Показати логи |
| `ocweb password` | Змінити пароль |
| `ocweb config` | Поточна конфігурація |
| `ocweb config set <key> <value>` | Змінити налаштування (port, hostname, workdir) |
| `ocweb upgrade` | Оновити OpenCode та перезапустити |
| `ocweb upgrade --schedule "<cron>"` | Автооновлення через systemd timer |
| `ocweb uninstall` | Видалити службу та всі налаштування |


## Приклади команд

Нижче мінімальний набір команд для повного життєвого циклу:

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

## Безпека

- **Пароль обов'язковий** — перевірка складності (8+ символів, цифра, спецсимвол)
- **Захищені локальні credentials** — `~/.config/ocweb/env` записується з правами `600`, а в metadata конфігурації зберігається scrypt-хеш пароля
- **Захист 0.0.0.0** — при біндингу на всі інтерфейси авторизація форсується

> [!CAUTION]
> При `--hostname 0.0.0.0` сервер доступний з мережі. Використовуйте Tailscale або ngrok для безпечного доступу.

---

## Віддалений доступ

**Tailscale (рекомендується)**
```bash
# Встановлення: https://tailscale.com
# Доступ: http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## Автооновлення

```bash
# Щодня о 03:00
ocweb upgrade --schedule "0 3 * * *"

# Кожної неділі о 02:00
ocweb upgrade --schedule "0 2 * * 0"
```

---

## Вимоги

- **Linux** з systemd 245+ (Ubuntu 20.04+, Debian 11+, Fedora 33+, Arch)
- **Node.js** 18+
- **OpenCode** встановлений та авторизований ([opencode.ai](https://opencode.ai))

---

## Як це працює

`ocweb setup` створює:

| Файл | Призначення |
|------|-------------|
| `~/.config/systemd/user/ocweb.service` | systemd user unit (авторестарт, автозапуск) |
| `~/.config/ocweb/env` | Файл оточення з credentials (права 600) |
| `~/.config/ocweb/config.json` | Конфігурація CLI |

---

## Дисклеймер

Цей проєкт не створений командою OpenCode і не афілійований з [OpenCode](https://opencode.ai).

## Ліцензія

[MIT](LICENSE)
