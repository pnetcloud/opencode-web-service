import test from 'node:test'
import assert from 'node:assert/strict'

import service from '../src/commands/service.js'

function createMockDeps() {
  const calls = []
  return {
    calls,
    ensureSetup: () => calls.push('ensureSetup'),
    startService: () => calls.push('startService'),
    stopService: () => calls.push('stopService'),
    restartService: () => calls.push('restartService'),
    log: {
      step: () => {},
      success: (msg) => calls.push(`success:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      dim: () => {},
    },
  }
}

test('service start calls ensureSetup then startService', async () => {
  const deps = createMockDeps()
  await service('start', [], deps)

  assert.ok(deps.calls.includes('ensureSetup'))
  assert.ok(deps.calls.includes('startService'))
  assert.ok(deps.calls.some((c) => c.includes('Service started')))
})

test('service stop calls ensureSetup then stopService', async () => {
  const deps = createMockDeps()
  await service('stop', [], deps)

  assert.ok(deps.calls.includes('ensureSetup'))
  assert.ok(deps.calls.includes('stopService'))
  assert.ok(deps.calls.some((c) => c.includes('Service stopped')))
})

test('service restart calls ensureSetup then restartService', async () => {
  const deps = createMockDeps()
  await service('restart', [], deps)

  assert.ok(deps.calls.includes('ensureSetup'))
  assert.ok(deps.calls.includes('restartService'))
  assert.ok(deps.calls.some((c) => c.includes('Service restarted')))
})

test('service handles systemd error with friendly message', async () => {
  const deps = createMockDeps()
  deps.startService = () => { throw new Error('unit not found') }
  await service('start', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('Failed to start service')))
})

test('service ignores unknown command', async () => {
  const deps = createMockDeps()
  await service('bogus', [], deps)

  assert.ok(deps.calls.includes('ensureSetup'))
  assert.ok(!deps.calls.some((c) => c.includes('success')))
})
