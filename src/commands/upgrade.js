import { execSync as _execSync } from 'node:child_process'
import { mkdirSync as _mkdirSync, writeFileSync as _writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup, saveConfig as _saveConfig } from '../utils/config.js'
import { stopService as _stopService, startService as _startService, daemonReload as _daemonReload } from '../utils/systemd.js'

const SYSTEMD_USER_DIR = join(homedir(), '.config', 'systemd', 'user')
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

export function cronToSystemdOnCalendar(schedule) {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error('Schedule must be a 5-field cron expression')
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  if (![minute, hour, dayOfMonth, month, dayOfWeek].every((part) => /^\*$|^\d+$/.test(part))) {
    throw new Error('Only numeric values and * are supported in schedule expressions')
  }

  if (minute !== '*' && (Number(minute) < 0 || Number(minute) > 59)) {
    throw new Error('Minute must be between 0 and 59')
  }
  if (hour !== '*' && (Number(hour) < 0 || Number(hour) > 23)) {
    throw new Error('Hour must be between 0 and 23')
  }
  if (dayOfMonth !== '*' && (Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31)) {
    throw new Error('Day of month must be between 1 and 31')
  }
  if (month !== '*' && (Number(month) < 1 || Number(month) > 12)) {
    throw new Error('Month must be between 1 and 12')
  }
  if (dayOfWeek !== '*' && !['0', '1', '2', '3', '4', '5', '6', '7'].includes(dayOfWeek)) {
    throw new Error('Day of week must be between 0 and 7')
  }

  const monthPart = month === '*' ? '*' : month.padStart(2, '0')
  const dayOfMonthPart = dayOfMonth === '*' ? '*' : dayOfMonth.padStart(2, '0')
  const dayOfWeekPart = dayOfWeek === '*' ? '' : `${WEEKDAYS[Number(dayOfWeek) % 7]} `
  const hourPart = hour === '*' ? '*' : hour.padStart(2, '0')
  const minutePart = minute === '*' ? '*' : minute.padStart(2, '0')

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

  const serviceUnit = `[Unit]
Description=OpenCode Auto-Upgrade

[Service]
Type=oneshot
ExecStart=${resolveOcweb()} upgrade
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
