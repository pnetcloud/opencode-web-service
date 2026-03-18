import { unlinkSync as _unlinkSync, rmSync as _rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import prompts from 'prompts'
import { execSync as _execSync } from 'node:child_process'
import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup, getConfigDir } from '../utils/config.js'
import { stopService as _stopService, disableService as _disableService, daemonReload as _daemonReload, UNIT_NAME } from '../utils/systemd.js'

const SYSTEMD_USER_DIR = join(homedir(), '.config', 'systemd', 'user')

export default async function uninstall(_command, _args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    stopService = _stopService,
    disableService = _disableService,
    daemonReload = _daemonReload,
    prompt = prompts,
    unlinkSync = _unlinkSync,
    rmSync = _rmSync,
    log = _log,
    execSync = _execSync,
  } = deps

  ensureSetup()

  const { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Remove OpenCode Web Service? This will stop the service and delete all settings.',
    initial: false,
  })

  if (!confirm) {
    log.dim('Cancelled.')
    return
  }

  log.step('Stopping and disabling service...')
  try { stopService() } catch { /* already stopped */ }
  try { disableService() } catch { /* already disabled */ }
  try { execSync('systemctl --user stop ocweb-upgrade.timer', { stdio: 'pipe' }) } catch { /* may not exist */ }
  try { execSync('systemctl --user disable ocweb-upgrade.timer', { stdio: 'pipe' }) } catch { /* may not exist */ }

  log.step('Removing systemd units...')
  const files = [
    join(SYSTEMD_USER_DIR, UNIT_NAME),
    join(SYSTEMD_USER_DIR, 'ocweb-upgrade.timer'),
    join(SYSTEMD_USER_DIR, 'ocweb-upgrade.service'),
  ]
  for (const f of files) {
    try { unlinkSync(f) } catch { /* may not exist */ }
  }

  log.step('Removing configuration...')
  try { rmSync(getConfigDir(), { recursive: true }) } catch { /* may not exist */ }

  daemonReload()
  log.success('OpenCode Web Service completely removed')
}
