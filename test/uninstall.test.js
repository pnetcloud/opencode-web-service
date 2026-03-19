import test from 'node:test'
import assert from 'node:assert/strict'

import uninstall from '../src/commands/uninstall.js'

test('uninstall stops and disables upgrade timer before deleting files', async () => {
  const calls = []

  await uninstall(null, null, {
    ensureSetup: () => ({ ok: true }),
    prompt: async () => ({ confirm: true }),
    stopService: () => calls.push('stopService'),
    disableService: () => calls.push('disableService'),
    execSync: (command) => calls.push(command),
    unlinkSync: (path) => calls.push(`unlink:${path}`),
    rmSync: (path) => calls.push(`rm:${path}`),
    daemonReload: () => calls.push('daemonReload'),
    log: {
      step: () => {},
      success: () => {},
      error: () => {},
      warn: () => {},
      dim: () => {},
    },
  })

  assert.ok(calls.includes('systemctl --user stop ocweb-upgrade.timer'))
  assert.ok(calls.includes('systemctl --user disable ocweb-upgrade.timer'))
  assert.ok(calls.includes('daemonReload'))
})

test('uninstall tolerates missing timer and config files', async () => {
  await uninstall(null, null, {
    ensureSetup: () => ({ ok: true }),
    prompt: async () => ({ confirm: true }),
    stopService: () => {},
    disableService: () => {},
    execSync: () => { throw new Error('missing timer') },
    unlinkSync: () => { throw new Error('missing file') },
    rmSync: () => { throw new Error('missing dir') },
    daemonReload: () => {},
    log: {
      step: () => {},
      success: () => {},
      error: () => {},
      warn: () => {},
      dim: () => {},
    },
  })
})
