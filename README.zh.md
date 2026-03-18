<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">一条命令将 OpenCode Web 服务器设置为可靠的 systemd 服务。</p>
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

### 快速开始

```bash
npx opencode-web-service setup
```

交互式向导将配置端口、主机名、工作目录和密码，然后创建具有开机自启和故障自动重启功能的 systemd 服务。

### 全局安装

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## 命令

| 命令 | 说明 |
|------|------|
| `ocweb setup` | 交互式设置向导 |
| `ocweb start` | 启动服务 |
| `ocweb stop` | 停止服务 |
| `ocweb restart` | 重启服务 |
| `ocweb status` | 显示服务状态（状态、PID、运行时间、URL） |
| `ocweb logs` | 显示日志 |
| `ocweb password` | 更改密码 |
| `ocweb config` | 显示当前配置 |
| `ocweb config set <key> <value>` | 修改设置（port、hostname、workdir） |
| `ocweb upgrade` | 升级 OpenCode 并重启服务 |
| `ocweb upgrade --schedule "<cron>"` | 通过 systemd timer 设置自动升级 |
| `ocweb uninstall` | 删除服务和所有配置 |


## 命令示例

下面是一组覆盖完整使用流程的常用命令：

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

## 安全

- **必须设置密码** — 安装时强制校验密码复杂度（8+ 字符、数字、特殊字符）
- **受保护的本地凭据** — `~/.config/ocweb/env` 以 `600` 权限写入，配置元数据中还会保存一个 scrypt 密码哈希
- **0.0.0.0 保护** — 绑定所有接口时强制启用认证

> [!CAUTION]
> 使用 `--hostname 0.0.0.0` 时，服务器可从网络访问。请使用 Tailscale 或 ngrok 进行安全的远程访问。

---

## 远程访问

**Tailscale（推荐）**
```bash
# 安装：https://tailscale.com
# 访问：http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## 自动升级

```bash
# 每天凌晨 3:00
ocweb upgrade --schedule "0 3 * * *"

# 每周日凌晨 2:00
ocweb upgrade --schedule "0 2 * * 0"
```

---

## 要求

- **Linux**，systemd 245+（Ubuntu 20.04+、Debian 11+、Fedora 33+、Arch）
- **Node.js** 18+
- **OpenCode** 已安装并认证（[opencode.ai](https://opencode.ai)）

---

## 免责声明

本项目非 OpenCode 团队开发，与 [OpenCode](https://opencode.ai) 无任何关联。

## 许可证

[MIT](LICENSE)
