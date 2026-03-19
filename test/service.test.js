import test from 'node:test'
import assert from 'node:assert/strict'

import service from '../src/commands/service.js'

function createMockDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    ensureSetup: () => { calls.push('ensureSetup'); return overrides.config || { port: 4096, hostname: 'localhost', mode: 'local' } },
    startService: () => calls.push('startService'),
    stopService: () => calls.push('stopService'),
    restartService: () => calls.push('restartService'),
    getLogs: () => overrides.logs || '',
    sleepMs: () => Promise.resolve(),
    log: {
      step: () => {},
      success: (msg) => calls.push(`success:${msg}`),
      info: (msg) => calls.push(`info:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      dim: (msg) => calls.push(`dim:${msg}`),
    },
    ...overrides,
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

test('service start shows local mode URL', async () => {
  const deps = createMockDeps({ config: { port: 4096, hostname: 'localhost', mode: 'local' } })
  await service('start', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('http://localhost:4096')))
})

test('service restart shows ngrok mode URL', async () => {
  const deps = createMockDeps({
    config: { port: 4096, hostname: '127.0.0.1', mode: 'ngrok' },
    logs: '  Public URL: https://abc123.ngrok-free.app\n',
  })
  await service('restart', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('ngrok tunnel')))
  assert.ok(deps.calls.some((c) => c.includes('https://abc123.ngrok-free.app')))
  assert.ok(deps.calls.some((c) => c.includes('http://127.0.0.1:4096')))
})

test('service stop does not show connection info', async () => {
  const deps = createMockDeps({ config: { port: 4096, hostname: 'localhost', mode: 'local' } })
  await service('stop', [], deps)

  assert.ok(!deps.calls.some((c) => c.includes('http://localhost:4096')))
})
