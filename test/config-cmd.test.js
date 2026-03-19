import test from 'node:test'
import assert from 'node:assert/strict'

import config, { normalizeConfigValue } from '../src/commands/config.js'

function mockDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    ensureSetup: () => ({
      port: 4096,
      hostname: 'localhost',
      workdir: '/home/test',
      username: 'admin',
      opencodePath: '/usr/bin/opencode',
      mode: 'local',
    }),
    saveConfig: (cfg) => calls.push(`saveConfig:port=${cfg.port}`),
    daemonReload: () => calls.push('daemonReload'),
    restartService: () => calls.push('restartService'),
    generateUnit: () => 'unit-content',
    parseEnvFileFn: () => ({ OPENCODE_SERVER_PASSWORD: 'StrongPass1!' }),
    writeFileSync: () => calls.push('writeFileSync'),
    chmodSync: () => calls.push('chmodSync'),
    exitProcess: (code) => calls.push(`exit:${code}`),
    log: {
      error: (msg) => calls.push(`error:${msg}`),
      dim: () => {},
      success: (msg) => calls.push(`success:${msg}`),
      info: () => {},
    },
    ...overrides,
  }
}

test('config set updates config, regenerates unit, and restarts', async () => {
  const deps = mockDeps()
  await config('config', ['set', 'port', '5000'], deps)

  assert.ok(deps.calls.includes('saveConfig:port=5000'))
  assert.ok(deps.calls.includes('writeFileSync'))
  assert.ok(deps.calls.includes('daemonReload'))
  assert.ok(deps.calls.includes('restartService'))
  assert.ok(deps.calls.some((c) => c.includes('port changed to 5000')))
})

test('config set rejects unknown keys', async () => {
  const deps = mockDeps()
  await config('config', ['set', 'badkey', 'val'], deps)

  assert.ok(deps.calls.some((c) => c.includes('Unknown key: badkey')))
  assert.ok(deps.calls.includes('exit:1'))
  assert.ok(!deps.calls.includes('saveConfig'))
})

test('config set rejects missing arguments', async () => {
  const deps = mockDeps()
  await config('config', ['set'], deps)

  assert.ok(deps.calls.some((c) => c.includes('Usage:')))
  assert.ok(deps.calls.includes('exit:1'))
})

test('config set rejects invalid port', async () => {
  const deps = mockDeps()
  await config('config', ['set', 'port', '99999'], deps)

  assert.ok(deps.calls.some((c) => c.includes('Port must be an integer')))
  assert.ok(deps.calls.includes('exit:1'))
})

test('config view displays current settings', async () => {
  const logged = []
  const originalLog = console.log
  console.log = (msg) => logged.push(msg)

  try {
    const deps = mockDeps()
    await config('config', [], deps)

    assert.ok(logged.some((l) => l.includes('4096')))
    assert.ok(logged.some((l) => l.includes('localhost')))
  } finally {
    console.log = originalLog
  }
})

// New validation tests

test('normalizeConfigValue rejects empty hostname', () => {
  assert.throws(
    () => normalizeConfigValue('hostname', ''),
    /Hostname must be non-empty/
  )
})

test('normalizeConfigValue rejects hostname with spaces', () => {
  assert.throws(
    () => normalizeConfigValue('hostname', 'my host'),
    /Hostname must be non-empty and contain no whitespace/
  )
})

test('normalizeConfigValue accepts valid hostname', () => {
  assert.equal(normalizeConfigValue('hostname', '127.0.0.1'), '127.0.0.1')
  assert.equal(normalizeConfigValue('hostname', 'localhost'), 'localhost')
})

test('normalizeConfigValue rejects empty workdir', () => {
  assert.throws(
    () => normalizeConfigValue('workdir', ''),
    /Working directory must be non-empty/
  )
})

test('normalizeConfigValue rejects non-existent workdir', () => {
  assert.throws(
    () => normalizeConfigValue('workdir', '/nonexistent/path', { existsSyncFn: () => false }),
    /Working directory does not exist/
  )
})

test('normalizeConfigValue accepts existing workdir', () => {
  const result = normalizeConfigValue('workdir', '/tmp', { existsSyncFn: () => true })
  assert.equal(result, '/tmp')
})

test('config set rejects empty hostname as missing value', async () => {
  const deps = mockDeps()
  await config('config', ['set', 'hostname', ''], deps)

  assert.ok(deps.calls.some((c) => c.includes('Usage:')))
  assert.ok(deps.calls.includes('exit:1'))
})

test('config set username rewrites env file and restarts service', async () => {
  const deps = mockDeps()
  deps.saveConfig = (cfg) => deps.calls.push(`saveConfig:username=${cfg.username}`)

  await config('config', ['set', 'username', 'newadmin'], deps)

  assert.ok(deps.calls.includes('writeFileSync'))
  assert.ok(deps.calls.includes('chmodSync'))
  assert.ok(deps.calls.includes('saveConfig:username=newadmin'))
  assert.ok(deps.calls.includes('restartService'))
})
