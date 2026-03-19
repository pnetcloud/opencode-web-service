import test from 'node:test'
import assert from 'node:assert/strict'

import statusCmd from '../src/commands/status.js'

test('status command logs success lines for active service', async () => {
  const logged = []
  await statusCmd('status', [], {
    ensureSetup: () => ({ hostname: 'localhost', port: 4096 }),
    getStatus: () => ({
      active: true,
      subState: 'running',
      pid: '1234',
      startedAt: 'Wed 2026-03-18 10:00:00 UTC',
    }),
    isUnitInstalled: () => true,
    existsSyncFn: () => false,
    log: {
      success: (msg) => logged.push(`success:${msg}`),
      info: (msg) => logged.push(`info:${msg}`),
      warn: (msg) => logged.push(`warn:${msg}`),
    },
  })

  assert.ok(logged[0].startsWith('success:Service active'))
  assert.ok(logged.some((l) => l.includes('PID: 1234')))
  assert.ok(logged.some((l) => l.includes('http://localhost:4096')))
  assert.ok(logged.some((l) => l.includes('Unit installed: yes')))
})

test('status command logs warn for inactive service', async () => {
  const logged = []
  await statusCmd('status', [], {
    ensureSetup: () => ({ hostname: 'localhost', port: 4096 }),
    getStatus: () => ({
      active: false,
      state: 'inactive',
      subState: 'dead',
      pid: null,
      startedAt: null,
    }),
    isUnitInstalled: () => true,
    existsSyncFn: () => false,
    log: {
      success: (msg) => logged.push(`success:${msg}`),
      info: (msg) => logged.push(`info:${msg}`),
      warn: (msg) => logged.push(`warn:${msg}`),
    },
  })

  assert.ok(logged[0].startsWith('warn:Service inactive'))
  assert.ok(logged.some((l) => l.includes('http://localhost:4096')))
})

test('status command shows health warnings', async () => {
  const logged = []
  const originalLog = console.log
  console.log = () => {}

  try {
    await statusCmd('status', [], {
      ensureSetup: () => ({
        hostname: 'localhost',
        port: 4096,
        _warnings: ['Environment file missing. Run "ocweb setup" to recreate.'],
      }),
      getStatus: () => ({
        active: true,
        subState: 'running',
        pid: null,
        startedAt: null,
      }),
      isUnitInstalled: () => true,
      existsSyncFn: () => false,
      log: {
        success: () => {},
        info: () => {},
        warn: (msg) => logged.push(msg),
      },
    })

    assert.ok(logged.some((l) => l.includes('Environment file missing')))
  } finally {
    console.log = originalLog
  }
})
