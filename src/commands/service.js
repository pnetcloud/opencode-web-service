import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup } from '../utils/config.js'
import { startService as _startService, stopService as _stopService, restartService as _restartService, getLogs as _getLogs } from '../utils/systemd.js'

export default async function service(command, _args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    startService = _startService,
    stopService = _stopService,
    restartService = _restartService,
    getLogs = _getLogs,
    sleepMs = (ms) => new Promise(r => setTimeout(r, ms)),
    log = _log,
  } = deps

  const config = ensureSetup()

  const actions = {
    start:   { fn: startService, ok: 'Service started', fail: 'Failed to start service' },
    stop:    { fn: stopService, ok: 'Service stopped', fail: 'Failed to stop service' },
    restart: { fn: restartService, ok: 'Service restarted', fail: 'Failed to restart service' },
  }

  const action = actions[command]
  if (!action) return

  log.step(`${command.charAt(0).toUpperCase() + command.slice(1)}ing service...`)
  try {
    action.fn()
    log.success(action.ok)

    // Show connection info after start/restart
    if (command !== 'stop') {
      const mode = config.mode || 'local'
      if (mode === 'ngrok') {
        log.info('Mode: ngrok tunnel')
        log.step('Waiting for ngrok tunnel...')
        let ngrokUrl = null
        for (const wait of [3000, 3000, 3000]) {
          await sleepMs(wait)
          try {
            const logs = getLogs(10)
            const m = logs.match(/Public URL: (https:\/\/[^\s]+)/)
            if (m) { ngrokUrl = m[1]; break }
          } catch { /* retry */ }
        }
        if (ngrokUrl) {
          log.success(`Public URL: ${ngrokUrl}`)
        } else {
          log.info('Run "ocweb logs" to see the ngrok public URL')
        }
        log.dim(`Backend: http://${config.hostname || '127.0.0.1'}:${config.port}`)
      } else {
        log.info(`URL: http://${config.hostname}:${config.port}`)
      }
    }
  } catch (err) {
    log.error(`${action.fail}: ${err.message}`)
    log.dim('Run "ocweb logs" for details')
  }
}
