<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">Ejecuta el servidor web de OpenCode como un servicio systemd confiable con un solo comando.</p>
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

### Inicio rápido

```bash
npx opencode-web-service setup
```

El asistente interactivo configurará el puerto, hostname, directorio de trabajo y contraseña, y creará un servicio systemd con inicio automático y reinicio ante fallos.

### Instalación global

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `ocweb setup` | Asistente de configuración interactivo |
| `ocweb start` | Iniciar el servicio |
| `ocweb stop` | Detener el servicio |
| `ocweb restart` | Reiniciar el servicio |
| `ocweb status` | Mostrar estado (estado, PID, tiempo activo, URL) |
| `ocweb logs` | Mostrar registros |
| `ocweb password` | Cambiar contraseña |
| `ocweb config` | Mostrar configuración actual |
| `ocweb config set <key> <value>` | Modificar configuración (port, hostname, workdir) |
| `ocweb upgrade` | Actualizar OpenCode y reiniciar el servicio |
| `ocweb upgrade --schedule "<cron>"` | Actualización automática vía systemd timer |
| `ocweb uninstall` | Eliminar servicio y toda la configuración |


## Ejemplos de comandos

Estos comandos cubren el flujo completo de uso del CLI:

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

## Seguridad

- **Contraseña obligatoria** — validación de complejidad durante la instalación (8+ caracteres, dígito, carácter especial)
- **Credenciales locales protegidas** — `~/.config/ocweb/env` se escribe con permisos `600` y la metadata de configuración también guarda un hash scrypt de la contraseña
- **Protección 0.0.0.0** — al vincular a todas las interfaces se fuerza la autenticación

> [!CAUTION]
> Al usar `--hostname 0.0.0.0`, el servidor es accesible desde la red. Use Tailscale o ngrok para acceso remoto seguro.

---

## Acceso remoto

**Tailscale (recomendado)**
```bash
# Instalación: https://tailscale.com
# Acceso: http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## Actualización automática

```bash
# Diariamente a las 3:00 AM
ocweb upgrade --schedule "0 3 * * *"

# Cada domingo a las 2:00 AM
ocweb upgrade --schedule "0 2 * * 0"
```

---

## Requisitos

- **Linux** con systemd 245+ (Ubuntu 20.04+, Debian 11+, Fedora 33+, Arch)
- **Node.js** 18+
- **OpenCode** instalado y autenticado ([opencode.ai](https://opencode.ai))

---

## Aviso legal

Este proyecto no está creado por el equipo de OpenCode y no está afiliado a [OpenCode](https://opencode.ai).

## Licencia

[MIT](LICENSE)
