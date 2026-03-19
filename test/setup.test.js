import test from 'node:test'
import assert from 'node:assert/strict'

import setup, { findOpencode } from '../src/commands/setup.js'

function mockDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    loadConfig: () => null,
    saveConfig: (cfg) => calls.push(`saveConfig:hash=${!!cfg.passwordHash}`),
    hashPassword: () => 'fakesalt:fakehash',
    daemonReload: () => calls.push('daemonReload'),
    enableService: () => calls.push('enableService'),
    startService: () => calls.push('startService'),
    enableLinger: () => calls.push('enableLinger'),
    generateUnit: () => 'unit-content',
    prompt: async () => ({
      port: '4096',
      hostname: 'localhost',
      workdir: '/tmp/test',
      username: 'admin',
      password: 'StrongPass1!',
    }),
    writeFileSync: (_path, content) => {
      calls.push('writeFileSync')
      if (typeof content === 'string' && !content.includes('OCWEB_PASSWORD_HASH')) {
        calls.push('envHasNoHash')
      }
    },
    chmodSync: (_path, mode) => calls.push(`chmodSync:${mode}`),
    mkdirSync: () => calls.push('mkdirSync'),
    exitProcess: (code) => calls.push(`exit:${code}`),
    _findOpencode: () => '/usr/bin/opencode',
    log: {
      info: () => {},
      success: (msg) => calls.push(`success:${msg}`),
      warn: () => {},
      error: (msg) => calls.push(`error:${msg}`),
      step: () => {},
      dim: () => {},
    },
    execSync: () => '/usr/bin/opencode\n',
    ...overrides,
  }
}

test('setup full happy path: env file includes hash, systemd enabled', async () => {
  const deps = mockDeps()
  await setup('setup', [], deps)

  assert.ok(deps.calls.includes('mkdirSync'))
  assert.ok(deps.calls.includes('writeFileSync'))
  assert.ok(deps.calls.includes('envHasNoHash'), 'env file must NOT include OCWEB_PASSWORD_HASH')
  assert.ok(deps.calls.includes(`chmodSync:${0o600}`))
  assert.ok(deps.calls.includes('saveConfig:hash=true'))
  assert.ok(deps.calls.includes('enableLinger'))
  assert.ok(deps.calls.includes('daemonReload'))
  assert.ok(deps.calls.includes('enableService'))
  assert.ok(deps.calls.includes('startService'))
})

test('setup exits when opencode not found', async () => {
  const deps = mockDeps({ _findOpencode: () => null })
  await setup('setup', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('opencode not found')))
  assert.ok(deps.calls.includes('exit:1'))
  assert.ok(!deps.calls.includes('startService'))
})

test('setup cancels when user aborts prompts', async () => {
  const deps = mockDeps({
    prompt: async () => ({}),
  })
  await setup('setup', [], deps)

  assert.ok(deps.calls.includes('exit:0'))
  assert.ok(!deps.calls.includes('writeFileSync'))
})

test('setup asks to reconfigure when config exists', async () => {
  const dimCalls = []
  const deps = mockDeps({
    loadConfig: () => ({ port: 4096 }),
    prompt: async () => ({ confirm: false }),
    log: {
      ...mockDeps().log,
      dim: (msg) => dimCalls.push(msg),
    },
  })
  await setup('setup', [], deps)

  assert.ok(dimCalls.some((m) => m.includes('Cancelled')))
  assert.ok(!deps.calls.includes('startService'))
})

test('setup continues reconfiguration when existing config is confirmed', async () => {
  let promptCalls = 0
  const deps = mockDeps({
    loadConfig: () => ({ port: 4096 }),
    prompt: async (config) => {
      promptCalls += 1
      if (Array.isArray(config)) {
        return {
          port: '4096',
          hostname: 'localhost',
          workdir: '/tmp/test',
          username: 'admin',
          password: 'StrongPass1!',
        }
      }
      return { confirm: true }
    },
  })

  await setup('setup', [], deps)

  assert.equal(promptCalls, 2)
  assert.ok(deps.calls.includes('startService'))
})

test('findOpencode returns path when opencode exists', () => {
  const path = findOpencode({
    execSync: () => '/usr/bin/opencode\n',
  })
  assert.equal(path, '/usr/bin/opencode')
})

test('findOpencode returns null when opencode missing', () => {
  const path = findOpencode({
    execSync: () => { throw new Error('not found') },
  })
  assert.equal(path, null)
})

test('setup warns for 0.0.0.0 and prompt validators enforce input rules', async () => {
  const warnings = []
  let questions

  const deps = mockDeps({
    prompt: async (config) => {
      if (Array.isArray(config)) {
        questions = config
        return {
          port: '4096',
          hostname: '0.0.0.0',
          workdir: '/tmp/test',
          username: 'admin',
          password: 'StrongPass1!',
        }
      }
      return { confirm: true }
    },
    log: {
      ...mockDeps().log,
      warn: (msg) => warnings.push(msg),
      info: () => {},
    },
  })

  await setup('setup', [], deps)

  assert.equal(questions[0].validate('70000'), 'Port must be 1-65535')
  assert.equal(questions[0].validate('4096'), true)
  assert.equal(questions[4].validate('short'), 'Minimum 8 characters, At least 1 digit, At least 1 special character (!@#$%^&* etc.)')
  assert.equal(questions[4].validate('StrongPass1!'), true)
  assert.equal(warnings.length, 2)
})
