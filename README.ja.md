<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">OpenCode Webサーバーを信頼性の高い systemd サービスとしてワンコマンドで起動。</p>
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

### クイックスタート

```bash
npx opencode-web-service setup
```

対話式ウィザードがポート、ホスト名、作業ディレクトリ、パスワードを設定し、自動起動・障害時自動再起動の systemd サービスを作成します。

### グローバルインストール

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## コマンド

| コマンド | 説明 |
|---------|------|
| `ocweb setup` | 対話式セットアップウィザード |
| `ocweb start` | サービスを開始 |
| `ocweb stop` | サービスを停止 |
| `ocweb restart` | サービスを再起動 |
| `ocweb status` | サービス状態を表示（状態、PID、稼働時間、URL） |
| `ocweb logs` | ログを表示 |
| `ocweb password` | パスワードを変更 |
| `ocweb config` | 現在の設定を表示 |
| `ocweb config set <key> <value>` | 設定を変更（port、hostname、workdir） |
| `ocweb upgrade` | OpenCode をアップグレードしてサービスを再起動 |
| `ocweb upgrade --schedule "<cron>"` | systemd timer で自動アップグレードを設定 |
| `ocweb uninstall` | サービスとすべての設定を削除 |


## コマンド例

CLI の一連の流れを確認できる代表的なコマンドです。

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

## セキュリティ

- **パスワード必須** — セットアップ時に複雑性を検証（8文字以上、数字、特殊文字）
- **保護されたローカル認証情報** — `~/.config/ocweb/env` は `600` 権限で書き込まれ、設定メタデータには scrypt のパスワードハッシュも保存されます
- **0.0.0.0 保護** — 全インターフェースへのバインド時は認証を強制

> [!CAUTION]
> `--hostname 0.0.0.0` 使用時、サーバーはネットワークからアクセス可能になります。安全なリモートアクセスには Tailscale または ngrok をご利用ください。

---

## リモートアクセス

**Tailscale（推奨）**
```bash
# インストール: https://tailscale.com
# アクセス: http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## 自動アップグレード

```bash
# 毎日午前3時
ocweb upgrade --schedule "0 3 * * *"

# 毎週日曜午前2時
ocweb upgrade --schedule "0 2 * * 0"
```

---

## 要件

- **Linux**、systemd 245+（Ubuntu 20.04+、Debian 11+、Fedora 33+、Arch）
- **Node.js** 18+
- **OpenCode** インストール済みかつ認証済み（[opencode.ai](https://opencode.ai)）

---

## 免責事項

本プロジェクトは OpenCode チームによって作成されたものではなく、[OpenCode](https://opencode.ai) とは一切関係ありません。

## ライセンス

[MIT](LICENSE)
