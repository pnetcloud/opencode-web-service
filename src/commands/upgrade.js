import { execSync as _execSync } from 'node:child_process'
import { mkdirSync as _mkdirSync, writeFileSync as _writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup, saveConfig as _saveConfig } from '../utils/config.js'
import { stopService as _stopService, startService as _startService, daemonReload as _daemonReload, SYSTEMD_USER_DIR } from '../utils/systemd.js'
const TIMER_NAME = 'ocweb-upgrade.timer'
const UPGRADE_SERVICE_NAME = 'ocweb-upgrade.service'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function quoteShellArg(value) {
  const normalized = String(value)
  if (/^[A-Za-z0-9_./:-]+$/.test(normalized)) {
    return normalized
  }
  return `'${normalized.replace(/'/g, `'\\''`)}'`
}

export function resolveOcwebPath(deps = {}) {
  const { execSync = _execSync, argv = process.argv } = deps
  try {
    return execSync('which ocweb', { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    // Fallback: use the absolute path to this script's entrypoint
    return argv[1]
  }
}

/**
 * Validate a single cron field value.
 * Supports: *, N, star/N, N-M, N,M,K
 */
function isValidCronField(field) {
  return /^\*$|^\*\/\d+$|^\d+(-\d+)?$|^\d+(,\d+)+$/.test(field)
}

/**
 * Convert a single cron field to systemd OnCalendar format.
 * Handles: star -> star, N -> zero-padded, star/N -> 00/N for minutes,
 * N-M -> N..M, N,M,K -> N,M,K
 */
function cronFieldToSystemd(field, pad = true) {
  if (field === '*') return '*'

  // Step: */N — systemd doesn't support step natively for all fields,
  // but OnCalendar supports e.g. *:00/15 for minutes
  if (field.startsWith('*/')) {
    const step = field.slice(2)
    return pad ? `00/${step}` : `*/${step}`
  }

  // Range: N-M → N..M (systemd OnCalendar format)
  if (field.includes('-')) {
    const [start, end] = field.split('-')
    const s = pad ? start.padStart(2, '0') : start
    const e = pad ? end.padStart(2, '0') : end
    return `${s}..${e}`
  }

  // List: N,M,K — systemd supports comma-separated values
  if (field.includes(',')) {
    return field.split(',').map((v) => (pad ? v.padStart(2, '0') : v)).join(',')
  }

  // Plain number
  return pad ? field.padStart(2, '0') : field
}

export function cronToSystemdOnCalendar(schedule) {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error('Schedule must be a 5-field cron expression')
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  if (![minute, hour, dayOfMonth, month, dayOfWeek].every(isValidCronField)) {
    throw new Error('Invalid cron field. Supported: *, N, */N, N-M, N,M,K')
  }

  // Basic range validation for plain numbers
  if (/^\d+$/.test(minute) && (Number(minute) < 0 || Number(minute) > 59)) {
    throw new Error('Minute must be between 0 and 59')
  }
  if (/^\d+$/.test(hour) && (Number(hour) < 0 || Number(hour) > 23)) {
    throw new Error('Hour must be between 0 and 23')
  }
  if (/^\d+$/.test(dayOfMonth) && (Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31)) {
    throw new Error('Day of month must be between 1 and 31')
  }
  if (/^\d+$/.test(month) && (Number(month) < 1 || Number(month) > 12)) {
    throw new Error('Month must be between 1 and 12')
  }
  if (/^\d+$/.test(dayOfWeek) && !['0', '1', '2', '3', '4', '5', '6', '7'].includes(dayOfWeek)) {
    throw new Error('Day of week must be between 0 and 7')
  }

  const monthPart = cronFieldToSystemd(month)
  const dayOfMonthPart = cronFieldToSystemd(dayOfMonth)
  const dayOfWeekPart = /^\d+$/.test(dayOfWeek) ? `${WEEKDAYS[Number(dayOfWeek) % 7]} ` : (dayOfWeek === '*' ? '' : '')
  const hourPart = cronFieldToSystemd(hour)
  const minutePart = cronFieldToSystemd(minute)

  return `${dayOfWeekPart}*-${monthPart}-${dayOfMonthPart} ${hourPart}:${minutePart}:00`
}

export function createUpgradeTimer(schedule, deps = {}) {
  const {
    mkdirSync = _mkdirSync,
    writeFileSync = _writeFileSync,
    resolveOcweb = () => resolveOcwebPath(deps),
  } = deps

  mkdirSync(SYSTEMD_USER_DIR, { recursive: true })

  const timerUnit = `[Unit]
Description=OpenCode Auto-Upgrade Timer

[Timer]
OnCalendar=${cronToSystemdOnCalendar(schedule)}
Persistent=true

[Install]
WantedBy=timers.target
`

  const ocwebPath = resolveOcweb()
  const serviceUnit = `[Unit]
Description=OpenCode Auto-Upgrade

[Service]
Type=oneshot
ExecStart=${quoteShellArg(ocwebPath)} upgrade
`

  writeFileSync(join(SYSTEMD_USER_DIR, TIMER_NAME), timerUnit, 'utf8')
  writeFileSync(join(SYSTEMD_USER_DIR, UPGRADE_SERVICE_NAME), serviceUnit, 'utf8')
}

export default async function upgrade(command, args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    saveConfig = _saveConfig,
    stopService = _stopService,
    startService = _startService,
    daemonReload = _daemonReload,
    execSync = _execSync,
    log = _log,
    exitProcess = (code) => process.exit(code),
    _createUpgradeTimer = createUpgradeTimer,
  } = deps

  const config = ensureSetup()

  // ocweb upgrade --schedule "0 3 * * *"
  const scheduleIdx = args.indexOf('--schedule')
  if (scheduleIdx !== -1) {
    const schedule = args[scheduleIdx + 1]
    if (!schedule) {
      log.error('Usage: ocweb upgrade --schedule "<cron>"')
      log.dim('Example: ocweb upgrade --schedule "0 3 * * *"')
      exitProcess(1)
      return
    }

    _createUpgradeTimer(schedule, deps)
    daemonReload()
    execSync(`systemctl --user enable --now ${TIMER_NAME}`, { stdio: 'pipe' })

    saveConfig({ ...config, upgradeSchedule: schedule })
    log.success(`Auto-upgrade scheduled: ${schedule}`)
    return
  }

  // Manual upgrade
  log.step('Upgrading OpenCode...')

  try {
    stopService()
    log.step('Service stopped')

    const opencodePath = config.opencodePath || resolveOcwebPath(deps)
    execSync(`${quoteShellArg(opencodePath)} upgrade`, { stdio: 'inherit' })
    log.success('OpenCode upgraded')

    startService()
    log.success('Service started — upgrade complete')
  } catch (err) {
    log.error(`Upgrade error: ${err.message}`)
    log.step('Attempting to restart previous version...')
    try {
      startService()
      log.warn('Previous version restarted')
    } catch {
      log.error('Failed to restart service')
    }
    exitProcess(1)
  }
}
