#!/usr/bin/env node

import { spawn as _spawn } from 'node:child_process'
import { readFileSync as _readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig as _loadConfig } from './utils/config.js'

export default async function boot(deps = {}) {
  const {
    loadConfig = _loadConfig,
    spawn = _spawn,
    readFileSync = _readFileSync,
    processObj = process,
    log = console,
    importNgrok = () => import('@ngrok/ngrok'),
  } = deps

  const config = loadConfig()
  if (!config) {
    log.error('No config found. Run "ocweb setup" first.')
    processObj.exit(1)
    return
  }

  if (config.mode !== 'ngrok') {
    log.error('Tunnel mode not configured. Run "ocweb setup" and select ngrok mode.')
    processObj.exit(1)
    return
  }

  // Load ngrok SDK
  let ngrok
  try {
    ngrok = await importNgrok()
  } catch {
    log.error('@ngrok/ngrok not installed. Run: npm install -g @ngrok/ngrok')
    processObj.exit(1)
    return
  }

  const backendPort = config.port || 4096

  // Read env file for opencode credentials + ngrok authtoken
  let envVars = { ...processObj.env }
  if (config.envFile) {
    try {
      const envContent = readFileSync(config.envFile, 'utf8')
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx > 0) {
          envVars[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
        }
      }
    } catch {
      // env file missing is non-fatal for opencode, but ngrok needs it
    }
  }

  // Spawn opencode backend
  const child = spawn(
    config.opencodePath || 'opencode',
    ['web', '--port', String(backendPort), '--hostname', '127.0.0.1'],
    {
      stdio: 'inherit',
      env: envVars,
      cwd: config.workdir || processObj.env.HOME,
    }
  )

  let exiting = false
  let listener = null

  child.on('exit', (code) => {
    if (!exiting) {
      log.error(`opencode exited unexpectedly with code ${code}`)
      processObj.exit(code || 1)
    }
  })

  child.on('error', (err) => {
    log.error(`Failed to start opencode: ${err.message}`)
    processObj.exit(1)
  })

  // Wait for backend to start, then establish ngrok tunnel
  const startupDelay = deps.startupDelay ?? 2000
  const timer = setTimeout(async () => {
    try {
      listener = await ngrok.forward({
        addr: backendPort,
        authtoken_from_env: true,
      })
      log.log(`\n  ngrok tunnel established!`)
      log.log(`  Public URL: ${listener.url()}`)
      log.log(`  Backend:    http://127.0.0.1:${backendPort}\n`)
    } catch (err) {
      log.error(`Failed to establish ngrok tunnel: ${err.message}`)
      child.kill('SIGTERM')
      processObj.exit(1)
    }
  }, startupDelay)

  const shutdown = () => {
    if (exiting) return
    exiting = true
    log.log('Shutting down...')
    clearTimeout(timer)
    if (listener) {
      listener.close().catch(() => {})
    }
    child.kill('SIGTERM')
  }

  processObj.on('SIGTERM', shutdown)
  processObj.on('SIGINT', shutdown)

  return { child, config }
}

// Direct execution
const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] && process.argv[1].endsWith('tunnel-server.js')) {
  boot()
}
