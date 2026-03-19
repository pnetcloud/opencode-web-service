import { execSync as _execSync } from 'node:child_process'
import { writeFileSync as _writeFileSync, chmodSync as _chmodSync, mkdirSync as _mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import prompts from 'prompts'
import { log as _log } from '../utils/output.js'
import { saveConfig as _saveConfig, loadConfig as _loadConfig, getConfigDir } from '../utils/config.js'
import { validatePassword, hashPassword as _hashPassword } from '../utils/password.js'
import { buildEnvFileContent } from '../utils/env.js'
import { daemonReload as _daemonReload, enableService as _enableService, startService as _startService, enableLinger as _enableLinger, generateUnit as _generateUnit, UNIT_NAME } from '../utils/systemd.js'

const SYSTEMD_USER_DIR = join(homedir(), '.config', 'systemd', 'user')
const ENV_FILE = join(getConfigDir(), 'env')

export function findOpencode(deps = {}) {
  const { execSync = _execSync } = deps
  try {
    return execSync('which opencode', { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return null
  }
}

export default async function setup(_command, _args, deps = {}) {
  const {
    loadConfig = _loadConfig,
    saveConfig = _saveConfig,
    hashPassword = _hashPassword,
    daemonReload = _daemonReload,
    enableService = _enableService,
    startService = _startService,
    enableLinger = _enableLinger,
    generateUnit = _generateUnit,
    prompt = prompts,
    writeFileSync = _writeFileSync,
    chmodSync = _chmodSync,
    mkdirSync = _mkdirSync,
    log = _log,
    exitProcess = (code) => process.exit(code),
    _findOpencode = findOpencode,
  } = deps

  log.info('OpenCode Web Service — Setup Wizard\n')

  // Check existing config
  const existing = loadConfig()
  if (existing) {
    const { confirm } = await prompt({
      type: 'confirm',
      name: 'confirm',
      message: 'Service already configured. Reconfigure?',
      initial: false,
    })
    if (!confirm) {
      log.dim('Cancelled.')
      return
    }
  }

  // Check opencode exists
  const opencodePath = _findOpencode(deps)
  if (!opencodePath) {
    log.error('opencode not found in PATH')
    log.dim('Install OpenCode: https://opencode.ai')
    exitProcess(1)
    return
  }
  log.success(`opencode found: ${opencodePath}`)

  // Interactive wizard
  const response = await prompt([
    {
      type: 'text',
      name: 'port',
      message: 'Port',
      initial: '4096',
      validate: (v) => {
        const n = Number(v)
        return (Number.isInteger(n) && n > 0 && n < 65536) || 'Port must be 1-65535'
      },
    },
    {
      type: 'text',
      name: 'hostname',
      message: 'Hostname',
      initial: 'localhost',
    },
    {
      type: 'text',
      name: 'workdir',
      message: 'Working directory',
      initial: homedir(),
    },
    {
      type: 'text',
      name: 'username',
      message: 'Username (for authentication)',
      initial: 'opencode',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password (min 8 chars, digit + special char)',
      validate: (v) => {
        const { valid, errors } = validatePassword(v)
        return valid || errors.join(', ')
      },
    },
  ])

  // Check if user cancelled (Ctrl+C)
  if (!response.password) {
    log.dim('Cancelled.')
    exitProcess(0)
    return
  }

  // Warn on 0.0.0.0
  if (response.hostname === '0.0.0.0') {
    log.warn('Hostname 0.0.0.0 — server will be accessible from the network!')
    log.warn('Make sure to use Tailscale/ngrok for secure access.')
    log.info('Authentication enforced.')
  }

  const config = {
    port: Number(response.port),
    hostname: response.hostname,
    workdir: response.workdir,
    username: response.username,
    opencodePath,
  }

  log.step('Creating configuration...')

  // Hash password and save env file
  const hashedPassword = hashPassword(response.password)
  mkdirSync(getConfigDir(), { recursive: true })
  writeFileSync(
    ENV_FILE,
    buildEnvFileContent({
      username: response.username,
      password: response.password,
    }),
    'utf8'
  )
  chmodSync(ENV_FILE, 0o600)
  log.success('Environment file created (mode 600)')

  // Save config (password stored as hash, not plaintext)
  saveConfig({ ...config, passwordHash: hashedPassword })
  log.success('Configuration saved')

  // Create systemd unit
  log.step('Creating systemd unit...')
  mkdirSync(SYSTEMD_USER_DIR, { recursive: true })
  const unitPath = join(SYSTEMD_USER_DIR, UNIT_NAME)
  writeFileSync(unitPath, generateUnit(opencodePath, config, ENV_FILE), 'utf8')
  log.success(`Unit created: ${unitPath}`)

  // Enable linger
  log.step('Enabling lingering...')
  enableLinger()
  log.success('Lingering enabled')

  // Reload, enable, start
  log.step('Starting service...')
  daemonReload()
  enableService()
  startService()
  log.success(`Service running at http://${config.hostname}:${config.port}`)

  console.log('')
  log.info('Manage: ocweb start | stop | restart | status | logs')
  log.info('Change password: ocweb password')
  log.info('Upgrade: ocweb upgrade')
}
