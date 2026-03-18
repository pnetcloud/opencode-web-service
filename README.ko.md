<p align="center">
  <h1 align="center">opencode-web-service</h1>
</p>
<p align="center">한 명령어로 OpenCode 웹 서버를 안정적인 systemd 서비스로 실행합니다.</p>
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

### 빠른 시작

```bash
npx opencode-web-service setup
```

대화형 위저드가 포트, 호스트명, 작업 디렉토리, 비밀번호를 설정하고 부팅 시 자동 시작, 장애 시 자동 재시작되는 systemd 서비스를 생성합니다.

### 글로벌 설치

```bash
npm i -g opencode-web-service
ocweb setup
```

---

## 명령어

| 명령어 | 설명 |
|--------|------|
| `ocweb setup` | 대화형 설정 위저드 |
| `ocweb start` | 서비스 시작 |
| `ocweb stop` | 서비스 중지 |
| `ocweb restart` | 서비스 재시작 |
| `ocweb status` | 서비스 상태 표시 (상태, PID, 가동 시간, URL) |
| `ocweb logs` | 로그 표시 |
| `ocweb password` | 비밀번호 변경 |
| `ocweb config` | 현재 설정 표시 |
| `ocweb config set <key> <value>` | 설정 변경 (port, hostname, workdir) |
| `ocweb upgrade` | OpenCode 업그레이드 및 서비스 재시작 |
| `ocweb upgrade --schedule "<cron>"` | systemd timer를 통한 자동 업그레이드 설정 |
| `ocweb uninstall` | 서비스 및 모든 설정 삭제 |


## 명령 예시

전체 사용 흐름을 빠르게 확인할 수 있는 대표 명령들입니다.

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

## 보안

- **비밀번호 필수** — 설정 시 복잡성 검증 (8자 이상, 숫자, 특수문자)
- **보호된 로컬 자격 증명** — `~/.config/ocweb/env`는 `600` 권한으로 기록되고, 설정 메타데이터에는 scrypt 비밀번호 해시도 저장됩니다
- **0.0.0.0 보호** — 모든 인터페이스 바인딩 시 인증 강제

> [!CAUTION]
> `--hostname 0.0.0.0` 사용 시 서버가 네트워크에서 접근 가능해집니다. 안전한 원격 접속을 위해 Tailscale 또는 ngrok을 사용하세요.

---

## 원격 접속

**Tailscale (권장)**
```bash
# 설치: https://tailscale.com
# 접속: http://your-machine.tailnet.ts.net:4096
```

**ngrok**
```bash
ngrok http 4096
```

---

## 자동 업그레이드

```bash
# 매일 오전 3시
ocweb upgrade --schedule "0 3 * * *"

# 매주 일요일 오전 2시
ocweb upgrade --schedule "0 2 * * 0"
```

---

## 요구 사항

- **Linux**, systemd 245+ (Ubuntu 20.04+, Debian 11+, Fedora 33+, Arch)
- **Node.js** 18+
- **OpenCode** 설치 및 인증 완료 ([opencode.ai](https://opencode.ai))

---

## 면책 조항

이 프로젝트는 OpenCode 팀이 만든 것이 아니며 [OpenCode](https://opencode.ai)와 관련이 없습니다.

## 라이선스

[MIT](LICENSE)
