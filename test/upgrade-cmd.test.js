import test from 'node:test'
import assert from 'node:assert/strict'

import upgrade from '../src/commands/upgrade.js'

function mockDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    ensureSetup: () => ({ port: 4096, opencodePath: 'opencode' }),
    saveConfig: (cfg) => calls.push(`saveConfig:schedule=${cfg.upgradeSchedule}`),
    stopService: () => calls.push('stopService'),
    startService: () => calls.push('startService'),
    daemonReload: () => calls.push('daemonReload'),
    execSync: (cmd) => calls.push(`execSync:${cmd}`),
    exitProcess: (code) => calls.push(`exit:${code}`),
    _createUpgradeTimer: (schedule) => calls.push(`createUpgradeTimer:${schedule}`),
    log: {
      step: () => {},
      success: (msg) => calls.push(`success:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      warn: (msg) => calls.push(`warn:${msg}`),
      dim: () => {},
    },
    ...overrides,
  }
}

test('upgrade manual: stop → exec opencode upgrade → start', async () => {
  const deps = mockDeps()
  await upgrade('upgrade', [], deps)

  assert.deepEqual(deps.calls, [
    'stopService',
    'execSync:opencode upgrade',
    'success:OpenCode upgraded',
    'startService',
    'success:Service started — upgrade complete',
  ])
})

test('upgrade manual: rollback on failure', async () => {
  const deps = mockDeps({
    execSync: (cmd) => {
      if (cmd === 'opencode upgrade') throw new Error('download failed')
      deps.calls.push(`execSync:${cmd}`)
    },
  })

  await upgrade('upgrade', [], deps)

  assert.ok(deps.calls.includes('stopService'))
  assert.ok(deps.calls.includes('startService'))
  assert.ok(deps.calls.some((c) => c.includes('download failed')))
  assert.ok(deps.calls.some((c) => c.includes('warn:Previous version restarted')))
})

test('upgrade --schedule creates timer and saves config', async () => {
  const deps = mockDeps()
  await upgrade('upgrade', ['--schedule', '0 3 * * *'], deps)

  assert.ok(deps.calls.includes('createUpgradeTimer:0 3 * * *'))
  assert.ok(deps.calls.includes('daemonReload'))
  assert.ok(deps.calls.some((c) => c.startsWith('execSync:systemctl --user enable --now')))
  assert.ok(deps.calls.includes('saveConfig:schedule=0 3 * * *'))
})

test('upgrade --schedule without cron expression shows error', async () => {
  const deps = mockDeps()
  await upgrade('upgrade', ['--schedule'], deps)

  assert.ok(deps.calls.some((c) => c.includes('Usage:')))
  assert.ok(deps.calls.includes('exit:1'))
})
