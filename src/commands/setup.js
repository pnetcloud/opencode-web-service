import { execSync as _execSync } from 'node:child_process'
import { writeFileSync as _writeFileSync, chmodSync as _chmodSync, mkdirSync as _mkdirSync, existsSync as _existsSync, accessSync as _accessSync, constants as fsConstants } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import prompts from 'prompts'
import { log as _log } from '../utils/output.js'
import { saveConfig as _saveConfig, loadConfig as _loadConfig, getConfigDir } from '../utils/config.js'
import { validatePassword, hashPassword as _hashPassword } from '../utils/password.js'
import { buildEnvFileContent, parseEnvFile as _parseEnvFile, ENV_FILE } from '../utils/env.js'
import { daemonReload as _daemonReload, enableService as _enableService, startService as _startService, restartService as _restartService, enableLinger as _enableLinger, generateUnit as _generateUnit, generateTunnelUnit as _generateTunnelUnit, getLogs as _getLogs, UNIT_NAME, SYSTEMD_USER_DIR } from '../utils/systemd.js'
import { collectDoctorChecks, summarizeDoctorChecks } from './doctor.js'



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
  return join(__dirname, '..', 'tunnel-server.js')
}

export function parseSetupArgs(args = []) {
  const options = {
    mode: null,
    port: null,
    hostname: null,
    workdir: null,
    username: null,
    password: null,
    ngrokAuthtoken: null,
    nonInteractive: false,
    force: false,
  }

  const flagMap = {
    '--mode': 'mode',
    '--port': 'port',
    '--hostname': 'hostname',
    '--workdir': 'workdir',
    '--username': 'username',
    '--password': 'password',
    '--ngrok-authtoken': 'ngrokAuthtoken',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--non-interactive' || arg === '-y' || arg === '--yes') {
      options.nonInteractive = true
      continue
    }

    if (arg === '--force') {
      options.force = true
      continue
    }

    const key = flagMap[arg]
    if (key && args[i + 1] !== undefined) {
      options[key] = args[i + 1]
      i++
    }
  }

  return options
}

export function hasProvidedSetupValues(options) {
  return Boolean(
    options.mode ||
    options.port ||
    options.hostname ||
    options.workdir ||
    options.username ||
    options.password ||
    options.ngrokAuthtoken
  )
}

export function normalizeSetupValue(key, value, deps = {}) {
  const {
    existsSync = _existsSync,
    accessSync = _accessSync,
  } = deps

  if (key === 'mode') {
    if (value !== 'local' && value !== 'ngrok') {
      throw new Error('Mode must be either "local" or "ngrok"')
    }
    return value
  }

  if (key === 'port') {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      throw new Error('Port must be 1-65535')
    }
    return n
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
    if (!existsSync(value)) {
      throw new Error(`Working directory does not exist: ${value}`)
    }
    try {
      accessSync(value, fsConstants.R_OK | fsConstants.W_OK)
    } catch {
      throw new Error(`Working directory is not writable: ${value}`)
    }
    return value
  }

  if (key === 'username') {
    if (!value || /\s/.test(value)) {
      throw new Error('Username must be non-empty and contain no whitespace')
    }
    return value
  }

  if (key === 'password') {
    const { valid, errors } = validatePassword(value)
    if (!valid) {
      throw new Error(errors.join(', '))
    }
    return value
  }

  if (key === 'ngrokAuthtoken') {
    if (!value || value.length <= 10) {
      throw new Error('Enter a valid ngrok authtoken')
    }
    return value
  }

  return value
}

function canRunWithoutPrompts(options, existingEnv = {}) {
  const mode = options.mode
  if (!mode || !options.port || !options.workdir) {
    return false
  }

  const hasCreds = (options.username && options.password) || (existingEnv.OPENCODE_SERVER_USERNAME && existingEnv.OPENCODE_SERVER_PASSWORD)
  if (!hasCreds) {
    return false
  }

  if (mode === 'local') {
    return Boolean(options.hostname)
  }

  return Boolean(options.ngrokAuthtoken || existingEnv.NGROK_AUTHTOKEN)
}

function logPreflightChecks(checks, log) {
  for (const check of checks) {
    const line = `${check.label}: ${check.detail}`
    if (check.status === 'pass') {
      log.success(line)
    } else if (check.status === 'warn') {
      log.warn(line)
    } else {
      log.error(line)
    }

    if (check.hint) {
      log.dim(`Hint: ${check.hint}`)
    }
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
    chmodSync = _chmodSync,
    mkdirSync = _mkdirSync,
    log = _log,
    exitProcess = (code) => process.exit(code),
    _findOpencode = findOpencode,
    _findNode = findNode,
    _getTunnelServerPath = getTunnelServerPath,
    parseEnvFileFn = _parseEnvFile,
    existsSync = _existsSync,
    accessSync = _accessSync,
    getLogs = _getLogs,
    sleepMs = (ms) => new Promise(r => setTimeout(r, ms)),
  } = deps
  const args = _args || []
  const options = parseSetupArgs(args)

  log.info('OpenCode Web Service — Setup Wizard\n')

  // Read existing env file for credential reuse
  const existingEnv = parseEnvFileFn(ENV_FILE)
  const autoNonInteractive = canRunWithoutPrompts(options, existingEnv)
  const nonInteractive = options.nonInteractive || autoNonInteractive

  const initialChecks = await collectDoctorChecks({ includeConfig: false }, deps)
  const initialSummary = summarizeDoctorChecks(initialChecks)
  if (initialSummary.failures.length > 0) {
    logPreflightChecks(initialChecks, log)
    log.error('Setup preflight failed.')
    exitProcess(1)
    return
  }

  // Check existing config
  const existing = loadConfig()
  if (existing) {
    if (nonInteractive && !options.force) {
      log.error('Service already configured. Re-run with --force to overwrite non-interactively.')
      exitProcess(1)
      return
    }
    if (!nonInteractive) {
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
  let mode
  if (nonInteractive && !options.mode) {
    log.error('Missing required setup flags for non-interactive mode: --mode')
    exitProcess(1)
    return
  }
  if (options.mode) {
    try {
      mode = normalizeSetupValue('mode', options.mode)
    } catch (error) {
      log.error(error.message)
      exitProcess(1)
      return
    }
  } else {
    const modeResponse = await prompt({
      type: 'select',
      name: 'mode',
      message: 'Access mode',
      choices: [
        { title: 'local', description: 'Best for localhost, LAN, or private network access you manage', value: 'local' },
        { title: 'ngrok', description: 'Best for a shareable public tunnel with an ngrok URL', value: 'ngrok' },
      ],
      initial: 0,
    })

    if (!modeResponse.mode) {
      log.dim('Cancelled.')
      exitProcess(0)
      return
    }

    mode = modeResponse.mode
  }

  if (!mode) {
    log.dim('Cancelled.')
    exitProcess(0)
    return
  }

  if (mode === 'local') {
    log.info('Local mode keeps OpenCode reachable on your chosen hostname/port. Use localhost for this machine only, or 0.0.0.0 for LAN/VPS access you manage.')
  } else {
    log.info('ngrok mode keeps the backend on 127.0.0.1 and exposes a public HTTPS URL through ngrok.')
  }

  const modeChecks = await collectDoctorChecks({ includeConfig: false, requireNgrok: mode === 'ngrok' }, deps)
  const modeSummary = summarizeDoctorChecks(modeChecks)
  if (modeSummary.failures.length > 0) {
    logPreflightChecks(modeChecks.filter((check) => check.status !== 'pass' || check.label === '@ngrok/ngrok'), log)
    log.error('Setup preflight failed.')
    exitProcess(1)
    return
  }

  // Ngrok-specific: authtoken
  let ngrokAuthtoken = null
  if (mode === 'ngrok') {
    const existingToken = existingEnv.NGROK_AUTHTOKEN || null

    if (options.ngrokAuthtoken) {
      try {
        ngrokAuthtoken = normalizeSetupValue('ngrokAuthtoken', options.ngrokAuthtoken)
      } catch (error) {
        log.error(error.message)
        exitProcess(1)
        return
      }
    }

    if (!ngrokAuthtoken && existingToken) {
      const masked = existingToken.slice(0, 6) + '...' + existingToken.slice(-4)
      const { keepToken } = nonInteractive
        ? { keepToken: true }
        : await prompt({
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
    } else if (!ngrokAuthtoken) {
      if (nonInteractive) {
        log.error('Missing required setup flags for non-interactive mode: --ngrok-authtoken')
        exitProcess(1)
        return
      }
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

  if (existingUser && existingPass) {
    const { keepCreds } = nonInteractive
      ? { keepCreds: !(options.username || options.password) }
      : await prompt({
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

  if (nonInteractive && ((options.username && !options.password) || (options.password && !options.username))) {
    const missing = options.username ? '--password' : '--username'
    log.error(`Missing required setup flags for non-interactive mode: ${missing}`)
    exitProcess(1)
    return
  }

  if (nonInteractive && options.mode && !canRunWithoutPrompts(options, existingEnv)) {
    const missing = []
    if (!options.port) missing.push('--port')
    if (!options.workdir) missing.push('--workdir')
    if (mode === 'local' && !options.hostname) missing.push('--hostname')
    if (mode === 'ngrok' && !(options.ngrokAuthtoken || existingEnv.NGROK_AUTHTOKEN)) missing.push('--ngrok-authtoken')
    if (!(options.username && options.password) && !(existingEnv.OPENCODE_SERVER_USERNAME && existingEnv.OPENCODE_SERVER_PASSWORD)) {
      missing.push('--username')
      missing.push('--password')
    }
    if (missing.length > 0) {
      log.error(`Missing required setup flags for non-interactive mode: ${missing.join(', ')}`)
      exitProcess(1)
      return
    }
  }

  const mainQuestions = [
    {
      type: 'text',
      name: 'port',
      message: mode === 'ngrok' ? 'Backend port (internal)' : 'Port',
      initial: options.port || (existing ? String(existing.port || 4096) : '4096'),
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
      initial: options.hostname || (existing ? (existing.hostname || 'localhost') : 'localhost'),
    })
  }

  mainQuestions.push(
    {
      type: 'text',
      name: 'workdir',
      message: 'Working directory',
      initial: options.workdir || (existing ? (existing.workdir || homedir()) : homedir()),
    },
  )

  // Only ask for credentials if not keeping existing
  if (!finalPassword) {
    mainQuestions.push(
      {
        type: 'text',
        name: 'username',
        message: 'Username (for authentication)',
        initial: options.username || finalUsername,
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

  const response = nonInteractive
    ? Object.fromEntries(mainQuestions.map((question) => [question.name, options[question.name] ?? question.initial]))
    : await prompt(mainQuestions)

  // Check if user cancelled (Ctrl+C)
  const actualPassword = finalPassword || response.password
  if (!actualPassword) {
    log.dim('Cancelled.')
    exitProcess(0)
    return
  }

  const actualUsername = response.username || options.username || finalUsername

  let normalizedPort
  let normalizedWorkdir
  let normalizedHostname
  try {
    normalizedPort = normalizeSetupValue('port', response.port, { existsSync, accessSync })
    normalizedWorkdir = normalizeSetupValue('workdir', response.workdir, { existsSync, accessSync })
    normalizedHostname = mode === 'ngrok'
      ? '127.0.0.1'
      : normalizeSetupValue('hostname', response.hostname, { existsSync, accessSync })
    normalizeSetupValue('username', actualUsername, { existsSync, accessSync })
    normalizeSetupValue('password', actualPassword, { existsSync, accessSync })
  } catch (error) {
    log.error(error.message)
    exitProcess(1)
    return
  }

  const hostname = normalizedHostname

  // Warn on 0.0.0.0 (only relevant for local mode)
  if (hostname === '0.0.0.0') {
    log.warn('Hostname 0.0.0.0 — server will be accessible from the network!')
    log.warn('Make sure to use Tailscale/ngrok for secure access.')
    log.info('Authentication enforced.')
  }

  const config = {
    port: normalizedPort,
    hostname,
    workdir: normalizedWorkdir,
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
