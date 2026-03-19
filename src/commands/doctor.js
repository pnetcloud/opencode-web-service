import { execSync as _execSync } from 'node:child_process'
import { accessSync as _accessSync, constants as fsConstants } from 'node:fs'
import { log as _log } from '../utils/output.js'
import { loadConfig as _loadConfig } from '../utils/config.js'
import { parseEnvFile as _parseEnvFile, ENV_FILE } from '../utils/env.js'

const MIN_NODE_MAJOR = 22

export function parseNodeMajor(version) {
  const match = String(version || '').match(/v?(\d+)/)
  return match ? Number(match[1]) : null
}

export function findCommand(command, deps = {}) {
  const { execSync = _execSync } = deps

  try {
    return execSync(`which ${command}`, { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return null
  }
}

function buildCheck(status, label, detail, hint = null) {
  return { status, label, detail, hint }
}

export async function collectDoctorChecks(options = {}, deps = {}) {
  const {
    loadConfig = _loadConfig,
    parseEnvFileFn = _parseEnvFile,
    accessSyncFn = _accessSync,
    processObj = process,
    importNgrok = () => import('@ngrok/ngrok'),
  } = deps
  const {
    includeConfig = true,
    requireNgrok = false,
    envFile = ENV_FILE,
  } = options

  const checks = []
  const nodeMajor = parseNodeMajor(processObj.version)

  if (nodeMajor && nodeMajor >= MIN_NODE_MAJOR) {
    checks.push(buildCheck('pass', 'Node.js', `Detected ${processObj.version}`))
  } else {
    checks.push(buildCheck('fail', 'Node.js', `Detected ${processObj.version || 'unknown'}`, `Use Node.js ${MIN_NODE_MAJOR}+`))
  }

  const opencodePath = findCommand('opencode', deps)
  if (opencodePath) {
    checks.push(buildCheck('pass', 'OpenCode CLI', opencodePath))
  } else {
    checks.push(buildCheck('fail', 'OpenCode CLI', 'opencode not found in PATH', 'Install and authenticate OpenCode: https://opencode.ai'))
  }

  for (const command of ['systemctl', 'journalctl', 'loginctl']) {
    const commandPath = findCommand(command, deps)
    if (commandPath) {
      checks.push(buildCheck('pass', command, commandPath))
    } else {
      checks.push(buildCheck('fail', command, `${command} not found in PATH`, 'Use Linux with systemd user services available'))
    }
  }

  if (requireNgrok) {
    try {
      await importNgrok()
      checks.push(buildCheck('pass', '@ngrok/ngrok', 'Installed'))
    } catch {
      checks.push(buildCheck('fail', '@ngrok/ngrok', 'Package not installed', 'Reinstall `opencode-web-service` with optional dependencies enabled, or use local mode'))
    }
  }

  if (!includeConfig) {
    return checks
  }

  const config = loadConfig()
  if (!config) {
    checks.push(buildCheck('warn', 'Configuration', 'Service not configured yet', 'Run `ocweb setup` to create the service'))
    return checks
  }

  checks.push(buildCheck('pass', 'Configuration', 'Config file found'))

  const envVars = parseEnvFileFn(envFile)
  if (envVars.OPENCODE_SERVER_USERNAME && envVars.OPENCODE_SERVER_PASSWORD) {
    checks.push(buildCheck('pass', 'Credentials', 'Environment credentials available'))
  } else {
    checks.push(buildCheck('fail', 'Credentials', 'Environment credentials missing', 'Run `ocweb setup` or `ocweb password` to recreate credentials'))
  }

  if (config.opencodePath) {
    try {
      accessSyncFn(config.opencodePath, fsConstants.X_OK)
      checks.push(buildCheck('pass', 'Configured opencodePath', config.opencodePath))
    } catch {
      checks.push(buildCheck('fail', 'Configured opencodePath', `${config.opencodePath} is not executable`, 'Run `ocweb setup` to refresh the service configuration'))
    }
  }

  if ((config.mode || 'local') === 'ngrok') {
    if (envVars.NGROK_AUTHTOKEN) {
      checks.push(buildCheck('pass', 'NGROK_AUTHTOKEN', 'Configured for tunnel mode'))
    } else {
      checks.push(buildCheck('fail', 'NGROK_AUTHTOKEN', 'Missing for tunnel mode', 'Re-run `ocweb setup` and provide an ngrok authtoken'))
    }

    try {
      await importNgrok()
      checks.push(buildCheck('pass', 'ngrok runtime', 'Tunnel dependency available'))
    } catch {
      checks.push(buildCheck('fail', 'ngrok runtime', 'Tunnel dependency unavailable', 'Reinstall `opencode-web-service` with optional dependencies enabled'))
    }
  }

  return checks
}

export function summarizeDoctorChecks(checks) {
  return {
    failures: checks.filter((check) => check.status === 'fail'),
    warnings: checks.filter((check) => check.status === 'warn'),
    passes: checks.filter((check) => check.status === 'pass'),
  }
}

export default async function doctor(_command, _args, deps = {}) {
  const {
    log = _log,
    exitProcess = (code) => process.exit(code),
  } = deps

  const checks = await collectDoctorChecks({ includeConfig: true }, deps)
  const summary = summarizeDoctorChecks(checks)

  log.info('OpenCode Web Service — Doctor\n')

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

  if (summary.failures.length > 0) {
    log.error(`Doctor found ${summary.failures.length} blocking issue(s).`)
    exitProcess(1)
    return
  }

  if (summary.warnings.length > 0) {
    log.warn(`Doctor completed with ${summary.warnings.length} warning(s).`)
    return
  }

  log.success('Doctor checks passed.')
}
