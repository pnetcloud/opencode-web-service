import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.config', 'ocweb')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

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
}

export function ensureSetup() {
  const config = loadConfig()
  if (!config) {
    throw new Error('Service not configured. Run "ocweb setup" first.')
  }
  return config
}
