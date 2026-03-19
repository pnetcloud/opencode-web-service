import { execSync } from 'node:child_process'
import { homedir, userInfo } from 'node:os'
import { join } from 'node:path'

const UNIT_NAME = 'ocweb.service'

export function quoteSystemdPath(value) {
  const str = String(value)
  if (/\s|['"\\]/.test(str)) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return str
}

export function generateUnit(opencodePath, config, envFilePath) {
  return `[Unit]
Description=OpenCode Web Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${quoteSystemdPath(config.workdir)}
ExecStart=${quoteSystemdPath(opencodePath)} web --port ${config.port} --hostname ${config.hostname}
EnvironmentFile=${quoteSystemdPath(envFilePath)}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`
}

export function generateTunnelUnit(nodePath, tunnelServerPath, config, envFilePath) {
  return `[Unit]
Description=OpenCode Web Server (ngrok tunnel)
After=network.target

[Service]
Type=simple
WorkingDirectory=${quoteSystemdPath(config.workdir)}
ExecStart=${quoteSystemdPath(nodePath)} ${quoteSystemdPath(tunnelServerPath)}
EnvironmentFile=${quoteSystemdPath(envFilePath)}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`
}

function run(cmd, opts = {}, deps = {}) {
  const { execSyncFn = execSync } = deps
  return execSyncFn(cmd, { encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit', ...opts })
}

function systemctl(action, args = [], deps = {}) {
  const suffix = args.length ? ` ${args.join(' ')}` : ''
  return run(`systemctl --user ${action}${suffix}`, { quiet: true }, deps).trim()
}

export function parseSystemctlShow(output) {
  const props = {}

  for (const line of output.split('\n')) {
    const [key, ...val] = line.split('=')
    if (key) {
      props[key.trim()] = val.join('=').trim()
    }
  }

  return {
    active: props.ActiveState === 'active',
    state: props.ActiveState || 'unknown',
    subState: props.SubState || 'unknown',
    pid: props.MainPID && props.MainPID !== '0' ? props.MainPID : null,
    startedAt: props.ExecMainStartTimestamp || null,
  }
}

export function daemonReload(deps = {}) {
  systemctl('daemon-reload', [], deps)
}

export function enableService(deps = {}) {
  systemctl('enable', [UNIT_NAME], deps)
}

export function startService(deps = {}) {
  systemctl('start', [UNIT_NAME], deps)
}

export function stopService(deps = {}) {
  systemctl('stop', [UNIT_NAME], deps)
}

export function restartService(deps = {}) {
  systemctl('restart', [UNIT_NAME], deps)
}

export function disableService(deps = {}) {
  systemctl('disable', [UNIT_NAME], deps)
}

export function getStatus(deps = {}) {
  try {
    const output = run(`systemctl --user show ${UNIT_NAME} --no-pager --property=ActiveState,SubState,MainPID,ExecMainStartTimestamp`, { quiet: true }, deps)
    return parseSystemctlShow(output)
  } catch {
    return { active: false, state: 'unknown', subState: 'unknown', pid: null, startedAt: null }
  }
}

export function getLogs(lines = 50, since = null, deps = {}) {
  let cmd = `journalctl --user -u ${UNIT_NAME} -n ${lines} --no-pager`
  if (since) {
    const safe = String(since).replace(/[^a-zA-Z0-9 :._\-]/g, '')
    cmd += ` --since "${safe}"`
  }
  return run(cmd, { quiet: true }, deps)
}

export function enableLinger(deps = {}) {
  const { userInfoFn = userInfo } = deps
  run(`loginctl enable-linger ${userInfoFn().username}`, {}, deps)
}

export function isUnitInstalled(deps = {}) {
  try {
    systemctl('cat', [UNIT_NAME], deps)
    return true
  } catch {
    return false
  }
}

export { UNIT_NAME }
