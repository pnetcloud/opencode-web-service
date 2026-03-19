import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup } from '../utils/config.js'
import { startService as _startService, stopService as _stopService, restartService as _restartService } from '../utils/systemd.js'

export default async function service(command, _args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    startService = _startService,
    stopService = _stopService,
    restartService = _restartService,
    log = _log,
  } = deps

  ensureSetup()

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
  } catch (err) {
    log.error(`${action.fail}: ${err.message}`)
    log.dim('Run "ocweb logs" for details')
  }
}
