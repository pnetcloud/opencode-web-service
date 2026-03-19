import { execSync as _execSync } from 'node:child_process'
import { writeFileSync as _writeFileSync, chmodSync as _chmodSync, mkdirSync as _mkdirSync, readFileSync as _readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import prompts from 'prompts'
import { log as _log } from '../utils/output.js'
import { saveConfig as _saveConfig, loadConfig as _loadConfig, getConfigDir } from '../utils/config.js'
import { validatePassword, hashPassword as _hashPassword } from '../utils/password.js'
import { buildEnvFileContent } from '../utils/env.js'
import { daemonReload as _daemonReload, enableService as _enableService, startService as _startService, restartService as _restartService, enableLinger as _enableLinger, generateUnit as _generateUnit, generateTunnelUnit as _generateTunnelUnit, getLogs as _getLogs, UNIT_NAME } from '../utils/systemd.js'
import { dirname, join as joinPath } from 'node:path'
import { fileURLToPath } from 'node:url'

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

export function findNode(deps = {}) {
  const { execSync = _execSync } = deps
  try {
    return execSync('which node', { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return process.execPath
  }
}

export function getTunnelServerPath() {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  return joinPath(__dirname, '..', 'tunnel-server.js')
}

export function checkNgrokInstalled() {
  try {
    require.resolve('@ngrok/ngrok')
    return true
  } catch {
    return false
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
    restartService = _restartService,
    enableLinger = _enableLinger,
    generateUnit = _generateUnit,
    generateTunnelUnit = _generateTunnelUnit,
    prompt = prompts,
    writeFileSync = _writeFileSync,
    readFileSync = _readFileSync,
    chmodSync = _chmodSync,
    mkdirSync = _mkdirSync,
    log = _log,
    exitProcess = (code) => process.exit(code),
    _findOpencode = findOpencode,
    _findNode = findNode,
    _getTunnelServerPath = getTunnelServerPath,
    getLogs = _getLogs,
    sleepMs = (ms) => new Promise(r => setTimeout(r, ms)),
  } = deps

  log.info('OpenCode Web Service — Setup Wizard\n')

  // Read existing env file for credential reuse
  let existingEnv = {}
  try {
    const envContent = readFileSync(ENV_FILE, 'utf8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx > 0) existingEnv[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
    }
  } catch { /* no existing env */ }

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

  // Mode selection
  const modeResponse = await prompt({
    type: 'select',
    name: 'mode',
    message: 'Access mode',
    choices: [
      { title: 'local', description: 'Direct access (default)', value: 'local' },
      { title: 'ngrok', description: 'Tunnel via ngrok (HTTP/2, unlimited tabs)', value: 'ngrok' },
    ],
    initial: 0,
  })

  if (!modeResponse.mode) {
    log.dim('Cancelled.')
    exitProcess(0)
    return
  }

  const mode = modeResponse.mode

  // Ngrok-specific: authtoken
  let ngrokAuthtoken = null
  if (mode === 'ngrok') {
    const existingToken = existingEnv.NGROK_AUTHTOKEN || null

    if (existingToken) {
      const masked = existingToken.slice(0, 6) + '...' + existingToken.slice(-4)
      const { keepToken } = await prompt({
        type: 'confirm',
        name: 'keepToken',
        message: `Keep existing ngrok authtoken (${masked})?`,
        initial: true,
      })

      if (keepToken) {
        ngrokAuthtoken = existingToken
      } else {
        const ngrokResponse = await prompt({
          type: 'password',
          name: 'authtoken',
          message: 'Ngrok authtoken (from https://dashboard.ngrok.com)',
          validate: (v) => v.length > 10 || 'Enter a valid ngrok authtoken',
        })
        if (!ngrokResponse.authtoken) {
          log.dim('Cancelled.')
          exitProcess(0)
          return
        }
        ngrokAuthtoken = ngrokResponse.authtoken
      }
    } else {
      const ngrokResponse = await prompt({
        type: 'password',
        name: 'authtoken',
        message: 'Ngrok authtoken (from https://dashboard.ngrok.com)',
        validate: (v) => v.length > 10 || 'Enter a valid ngrok authtoken',
      })
      if (!ngrokResponse.authtoken) {
        log.dim('Cancelled.')
        exitProcess(0)
        return
      }
      ngrokAuthtoken = ngrokResponse.authtoken
    }
  }

  // Interactive wizard
  const existingUser = existingEnv.OPENCODE_SERVER_USERNAME || null
  const existingPass = existingEnv.OPENCODE_SERVER_PASSWORD || null

  // If credentials exist, offer to keep them
  let finalUsername = existingUser || 'opencode'
  let finalPassword = null

  if (existing && existingUser && existingPass) {
    const { keepCreds } = await prompt({
      type: 'confirm',
      name: 'keepCreds',
      message: `Keep existing credentials (${existingUser})?`,
      initial: true,
    })

    if (keepCreds) {
      finalUsername = existingUser
      finalPassword = existingPass
    }
  }

  const mainQuestions = [
    {
      type: 'text',
      name: 'port',
      message: mode === 'ngrok' ? 'Backend port (internal)' : 'Port',
      initial: existing ? String(existing.port || 4096) : '4096',
      validate: (v) => {
        const n = Number(v)
        return (Number.isInteger(n) && n > 0 && n < 65536) || 'Port must be 1-65535'
      },
    },
  ]

  // Only ask hostname for local mode (ngrok gives its own URL)
  if (mode === 'local') {
    mainQuestions.push({
      type: 'text',
      name: 'hostname',
      message: 'Hostname',
      initial: existing ? (existing.hostname || 'localhost') : 'localhost',
    })
  }

  mainQuestions.push(
    {
      type: 'text',
      name: 'workdir',
      message: 'Working directory',
      initial: existing ? (existing.workdir || homedir()) : homedir(),
    },
  )

  // Only ask for credentials if not keeping existing
  if (!finalPassword) {
    mainQuestions.push(
      {
        type: 'text',
        name: 'username',
        message: 'Username (for authentication)',
        initial: finalUsername,
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
    )
  }

  const response = await prompt(mainQuestions)

  // Check if user cancelled (Ctrl+C)
  const actualPassword = finalPassword || response.password
  if (!actualPassword) {
    log.dim('Cancelled.')
    exitProcess(0)
    return
  }

  const actualUsername = response.username || finalUsername

  const hostname = mode === 'ngrok' ? '127.0.0.1' : response.hostname

  // Warn on 0.0.0.0 (only relevant for local mode)
  if (hostname === '0.0.0.0') {
    log.warn('Hostname 0.0.0.0 — server will be accessible from the network!')
    log.warn('Make sure to use Tailscale/ngrok for secure access.')
    log.info('Authentication enforced.')
  }

  const config = {
    port: Number(response.port),
    hostname,
    workdir: response.workdir,
    username: actualUsername,
    opencodePath,
    mode,
    envFile: ENV_FILE,
  }

  log.step('Creating configuration...')

  // Hash password and save env file
  const hashedPassword = hashPassword(actualPassword)
  mkdirSync(getConfigDir(), { recursive: true })
  writeFileSync(
    ENV_FILE,
    buildEnvFileContent({
      username: actualUsername,
      password: actualPassword,
      ngrokAuthtoken,
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

  if (mode === 'ngrok') {
    const nodePath = _findNode(deps)
    const tunnelServerPath = _getTunnelServerPath()
    writeFileSync(unitPath, generateTunnelUnit(nodePath, tunnelServerPath, config, ENV_FILE), 'utf8')
    log.success(`Tunnel unit created: ${unitPath}`)
  } else {
    writeFileSync(unitPath, generateUnit(opencodePath, config, ENV_FILE), 'utf8')
    log.success(`Unit created: ${unitPath}`)
  }

  // Enable linger
  log.step('Enabling lingering...')
  enableLinger()
  log.success('Lingering enabled')

  // Reload, enable, start/restart
  log.step('Starting service...')
  daemonReload()
  enableService()
  if (existing) {
    restartService()
  } else {
    startService()
  }

  if (mode === 'ngrok') {
    log.success('Service started with ngrok tunnel')
    log.step('Waiting for ngrok tunnel...')
    let ngrokUrl = null
    for (const wait of [3000, 3000, 3000]) {
      await sleepMs(wait)
      try {
        const logs = getLogs(10)
        const urlMatch = logs.match(/Public URL: (https:\/\/[^\s]+)/)
        if (urlMatch) { ngrokUrl = urlMatch[1]; break }
      } catch { /* retry */ }
    }
    if (ngrokUrl) {
      log.success(`Public URL: ${ngrokUrl}`)
    } else {
      log.info('Run "ocweb logs" to see the ngrok public URL')
    }
  } else {
    log.success(`Service running at http://${config.hostname}:${config.port}`)
  }

  console.log('')
  log.info('Manage: ocweb start | stop | restart | status | logs')
  log.info('Change password: ocweb password')
  log.info('Upgrade: ocweb upgrade')
}
