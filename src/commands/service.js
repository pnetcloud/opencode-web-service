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

  switch (command) {
    case 'start':
      log.step('Starting service...')
      startService()
      log.success('Service started')
      break
    case 'stop':
      log.step('Stopping service...')
      stopService()
      log.success('Service stopped')
      break
    case 'restart':
      log.step('Restarting service...')
      restartService()
      log.success('Service restarted')
      break
  }
}
