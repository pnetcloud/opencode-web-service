import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync, accessSync, constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.config', 'ocweb')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const ENV_FILE = join(CONFIG_DIR, 'env')

export function getConfigDir() {
  return CONFIG_DIR
}

export function getConfigPath() {
  return CONFIG_FILE
}

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    return null
  }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8')
  chmodSync(CONFIG_FILE, 0o600)
}

export function ensureSetup(deps = {}) {
  const {
    loadConfigFn = loadConfig,
    existsSyncFn = existsSync,
    accessSyncFn = accessSync,
    envFile = ENV_FILE,
  } = deps

  const config = loadConfigFn()
  if (!config) {
    throw new Error('Service not configured. Run "ocweb setup" first.')
  }

  const warnings = []

  if (!existsSyncFn(envFile)) {
    warnings.push('Environment file missing. Run "ocweb setup" to recreate.')
  }

  if (config.opencodePath) {
    try {
      accessSyncFn(config.opencodePath, constants.X_OK)
    } catch {
      warnings.push(`opencode not found at ${config.opencodePath}`)
    }
  }

  config._warnings = warnings
  return config
}
