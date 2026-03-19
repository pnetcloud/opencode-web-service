import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup, getConfigDir } from '../utils/config.js'
import { getStatus as _getStatus, isUnitInstalled as _isUnitInstalled } from '../utils/systemd.js'
import { join } from 'node:path'
import { existsSync as _existsSync } from 'node:fs'
import { homedir } from 'node:os'

export function formatUptime(startedAt, now = Date.now()) {
  if (!startedAt) {
    return null
  }

  const started = Date.parse(startedAt)
  if (Number.isNaN(started)) {
    return null
  }

  const diffMs = Math.max(0, now - started)
  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts = []

  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (!parts.length || seconds) parts.push(`${seconds}s`)

  return parts.join(' ')
}

export function buildStatusLines(config, st, extra = {}, now = Date.now()) {
  const lines = []

  if (!st.active) {
    lines.push(`Service inactive (${st.state})`)
  } else {
    lines.push(`Service active (${st.subState})`)

    if (st.pid) {
      lines.push(`PID: ${st.pid}`)
    }

    const uptime = formatUptime(st.startedAt, now)
    if (uptime) {
      lines.push(`Uptime: ${uptime}`)
    }
  }

  lines.push(`URL: http://${config.hostname}:${config.port}`)

  if (config.mode && config.mode !== 'local') {
    lines.push(`Mode: ${config.mode} tunnel`)
    if (config.mode === 'ngrok') {
      lines.push('Public URL: see "ocweb logs"')
    }
  }

  if (extra.unitInstalled !== undefined) {
    lines.push(`Unit installed: ${extra.unitInstalled ? 'yes' : 'no'}`)
  }
  if (extra.timerEnabled !== undefined) {
    lines.push(`Upgrade timer: ${extra.timerEnabled ? 'enabled' : 'not configured'}`)
  }
  if (extra.configDir) {
    lines.push(`Config: ${extra.configDir}`)
  }

  return {
    level: st.active ? 'success' : 'warn',
    lines,
  }
}

export default async function status(_command, _args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    getStatus = _getStatus,
    isUnitInstalled = _isUnitInstalled,
    existsSyncFn = _existsSync,
    log = _log,
  } = deps

  const config = ensureSetup()
  const st = getStatus()

  const configDir = getConfigDir()
  const timerPath = join(homedir(), '.config', 'systemd', 'user', 'ocweb-upgrade.timer')
  const extra = {
    unitInstalled: isUnitInstalled(),
    timerEnabled: existsSyncFn(timerPath),
    configDir,
  }

  const output = buildStatusLines(config, st, extra)

  if (output.level === 'warn') {
    log.warn(output.lines[0])
    for (const line of output.lines.slice(1)) {
      log.info(line)
    }
  } else {
    log.success(output.lines[0])
    for (const line of output.lines.slice(1)) {
      log.info(line)
    }
  }

  // Show health warnings from ensureSetup
  if (config._warnings && config._warnings.length > 0) {
    console.log('')
    for (const w of config._warnings) {
      log.warn(w)
    }
  }
}
