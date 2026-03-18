import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup } from '../utils/config.js'
import { getStatus as _getStatus } from '../utils/systemd.js'

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

export function buildStatusLines(config, st, now = Date.now()) {
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

  return {
    level: st.active ? 'success' : 'warn',
    lines,
  }
}

export default async function status(_command, _args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    getStatus = _getStatus,
    log = _log,
  } = deps

  const config = ensureSetup()
  const st = getStatus()
  const output = buildStatusLines(config, st)

  if (output.level === 'warn') {
    log.warn(output.lines[0])
    for (const line of output.lines.slice(1)) {
      log.info(line)
    }
    return
  }

  log.success(output.lines[0])
  for (const line of output.lines.slice(1)) {
    log.info(line)
  }
}
