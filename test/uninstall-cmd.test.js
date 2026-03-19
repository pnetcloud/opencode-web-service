import test from 'node:test'
import assert from 'node:assert/strict'

import uninstall from '../src/commands/uninstall.js'

function mockDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    ensureSetup: () => calls.push('ensureSetup'),
    stopService: () => calls.push('stopService'),
    disableService: () => calls.push('disableService'),
    daemonReload: () => calls.push('daemonReload'),
    unlinkSync: (f) => calls.push(`unlinkSync:${f.split('/').pop()}`),
    rmSync: () => calls.push('rmSync'),
    prompt: async () => ({ confirm: true }),
    log: {
      step: () => {},
      dim: (msg) => calls.push(`dim:${msg}`),
      success: (msg) => calls.push(`success:${msg}`),
    },
    ...overrides,
  }
}

test('uninstall confirms then stops, disables, removes files, and reloads', async () => {
  const deps = mockDeps()
  await uninstall('uninstall', [], deps)

  assert.ok(deps.calls.includes('ensureSetup'))
  assert.ok(deps.calls.includes('stopService'))
  assert.ok(deps.calls.includes('disableService'))
  assert.ok(deps.calls.some((c) => c.includes('unlinkSync:ocweb.service')))
  assert.ok(deps.calls.some((c) => c.includes('unlinkSync:ocweb-upgrade.timer')))
  assert.ok(deps.calls.some((c) => c.includes('unlinkSync:ocweb-upgrade.service')))
  assert.ok(deps.calls.includes('rmSync'))
  assert.ok(deps.calls.includes('daemonReload'))
  assert.ok(deps.calls.some((c) => c.includes('completely removed')))
})

test('uninstall cancels on declining confirmation', async () => {
  const deps = mockDeps({ prompt: async () => ({ confirm: false }) })
  await uninstall('uninstall', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('Cancelled')))
  assert.ok(!deps.calls.includes('stopService'))
  assert.ok(!deps.calls.includes('daemonReload'))
})

test('uninstall handles already-stopped service gracefully', async () => {
  const deps = mockDeps({
    stopService: () => { throw new Error('already stopped') },
    disableService: () => { throw new Error('already disabled') },
  })
  // Should not throw
  await uninstall('uninstall', [], deps)

  assert.ok(deps.calls.includes('daemonReload'))
  assert.ok(deps.calls.some((c) => c.includes('completely removed')))
})
