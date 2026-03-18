<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">Запуск OpenCode веб-сервера как надёжной systemd-службы одной командой.</p>
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

### Быстрый старт

```bash
npx opencode-web-service setup
```

Интерактивный визард настроит порт, hostname, рабочую директорию и пароль — затем создаст systemd-службу с автозапуском и авторестартом при сбоях.

### Глобальная установка

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## Команды

| Команда | Описание |
|---------|----------|
| `ocweb setup` | Интерактивный визард настройки |
| `ocweb start` | Запустить службу |
| `ocweb stop` | Остановить службу |
| `ocweb restart` | Перезапустить службу |
| `ocweb status` | Статус (состояние, PID, uptime, URL) |
| `ocweb logs` | Показать логи |
| `ocweb password` | Сменить пароль |
| `ocweb config` | Текущая конфигурация |
| `ocweb config set <key> <value>` | Изменить настройку (port, hostname, workdir) |
| `ocweb upgrade` | Обновить OpenCode и перезапустить |
| `ocweb upgrade --schedule "<cron>"` | Автообновление через systemd timer |
| `ocweb uninstall` | Удалить службу и все настройки |


## Примеры команд

Ниже минимальный набор команд для полного жизненного цикла:

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

## Безопасность

- **Пароль обязателен** — проверка сложности при установке (8+ символов, цифра, спецсимвол)
- **Защищённые локальные credentials** — `~/.config/ocweb/env` записывается с правами `600`, а в metadata конфигурации хранится scrypt-хеш пароля
- **Защита 0.0.0.0** — при биндинге на все интерфейсы авторизация форсируется

> [!CAUTION]
> При `--hostname 0.0.0.0` сервер доступен из сети. Используйте Tailscale или ngrok для безопасного доступа.

---

## Удалённый доступ

**Tailscale (рекомендуется)**
```bash
# Установка: https://tailscale.com
# Доступ: http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## Автообновление

```bash
# Ежедневно в 03:00
ocweb upgrade --schedule "0 3 * * *"

# Каждое воскресенье в 02:00
ocweb upgrade --schedule "0 2 * * 0"
```

Используется systemd timer — cron не нужен.

---

## Требования

- **Linux** с systemd 245+ (Ubuntu 20.04+, Debian 11+, Fedora 33+, Arch)
- **Node.js** 18+
- **OpenCode** установлен и авторизован ([opencode.ai](https://opencode.ai))

---

## Как это работает

`ocweb setup` создаёт:

| Файл | Назначение |
|------|------------|
| `~/.config/systemd/user/ocweb.service` | systemd user unit (авторестарт, автозапуск) |
| `~/.config/ocweb/env` | Файл окружения с credentials (права 600) |
| `~/.config/ocweb/config.json` | Конфигурация CLI |

Служба запускает `opencode web --port <port> --hostname <hostname>` под вашим пользователем с включённым lingering.

---

## Решение проблем

**Служба не запускается**
```bash
ocweb logs           # Проверить логи
which opencode       # Убедиться что OpenCode установлен
```

**Порт занят**
```bash
lsof -i :4096
ocweb config set port 4096
```

**Нет удалённого доступа**
1. `ocweb status` — служба должна быть active
2. hostname должен быть `0.0.0.0` (не `localhost`)
3. Проверьте файрвол

---

## Дисклеймер

Этот проект не создан командой OpenCode и не аффилирован с [OpenCode](https://opencode.ai).

## Лицензия

[MIT](LICENSE)
