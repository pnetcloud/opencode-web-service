import { writeFileSync as _writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup, saveConfig as _saveConfig, getConfigDir } from '../utils/config.js'
import { daemonReload as _daemonReload, restartService as _restartService, generateUnit as _generateUnit, generateTunnelUnit as _generateTunnelUnit, UNIT_NAME } from '../utils/systemd.js'
import { findNode as _findNode, getTunnelServerPath as _getTunnelServerPath } from './setup.js'

const SYSTEMD_USER_DIR = join(homedir(), '.config', 'systemd', 'user')
const ENV_FILE = join(getConfigDir(), 'env')

const ALLOWED_KEYS = ['port', 'hostname', 'workdir']

export function normalizeConfigValue(key, value, deps = {}) {
  const { existsSyncFn = existsSync } = deps

  if (key === 'port') {
    const port = Number(value)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Port must be an integer between 1 and 65535')
    }
    return port
  }

  if (key === 'hostname') {
    if (!value || /\s/.test(value)) {
      throw new Error('Hostname must be non-empty and contain no whitespace')
    }
    return value
  }

  if (key === 'workdir') {
    if (!value) {
      throw new Error('Working directory must be non-empty')
    }
    if (!existsSyncFn(value)) {
      throw new Error(`Working directory does not exist: ${value}`)
    }
    return value
  }

  return value
}

export function buildConfigLines(cfg) {
  return [
    `Port:       ${cfg.port}`,
    `Hostname:   ${cfg.hostname}`,
    `Workdir:    ${cfg.workdir}`,
    `Username:   ${cfg.username || 'opencode'}`,
    `Auto-update: ${cfg.upgradeSchedule || 'not configured'}`,
  ]
}

export default async function config(command, args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    saveConfig = _saveConfig,
    daemonReload = _daemonReload,
    restartService = _restartService,
    generateUnit = _generateUnit,
    generateTunnelUnit = _generateTunnelUnit,
    findNode = _findNode,
    getTunnelServerPath = _getTunnelServerPath,
    writeFileSync = _writeFileSync,
    log = _log,
    exitProcess = (code) => process.exit(code),
  } = deps

  const cfg = ensureSetup()

  // ocweb config set <key> <value>
  if (args[0] === 'set') {
    const key = args[1]
    const value = args[2]

    if (!key || !value) {
      log.error('Usage: ocweb config set <key> <value>')
      log.dim(`Available keys: ${ALLOWED_KEYS.join(', ')}`)
      exitProcess(1)
      return
    }

    if (!ALLOWED_KEYS.includes(key)) {
      log.error(`Unknown key: ${key}`)
      log.dim(`Available keys: ${ALLOWED_KEYS.join(', ')}`)
      exitProcess(1)
      return
    }

    let normalizedValue
    try {
      normalizedValue = normalizeConfigValue(key, value)
    } catch (error) {
      log.error(error.message)
      exitProcess(1)
      return
    }

    const newConfig = { ...cfg, [key]: normalizedValue }
    saveConfig(newConfig)

    const unitPath = join(SYSTEMD_USER_DIR, UNIT_NAME)
    if (newConfig.mode === 'ngrok') {
      const nodePath = findNode(deps)
      const tunnelServerPath = getTunnelServerPath()
      writeFileSync(unitPath, generateTunnelUnit(nodePath, tunnelServerPath, newConfig, ENV_FILE), 'utf8')
    } else {
      writeFileSync(unitPath, generateUnit(newConfig.opencodePath, newConfig, ENV_FILE), 'utf8')
    }

    daemonReload()
    restartService()
    log.success(`${key} changed to ${value}, service restarted`)
    return
  }

  // ocweb config — show current
  console.log('')
  log.info('Current configuration:')
  for (const line of buildConfigLines(cfg)) {
    console.log(`  ${line}`)
  }
  console.log('')
}
