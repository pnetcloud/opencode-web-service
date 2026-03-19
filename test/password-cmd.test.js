import test from 'node:test'
import assert from 'node:assert/strict'

import password from '../src/commands/password.js'

test('password command updates env, config, and restarts on valid input', async () => {
  const calls = []
  let writtenContent = null

  await password('password', [], {
    ensureSetup: () => ({ username: 'admin', port: 4096 }),
    saveConfig: (cfg) => calls.push(`saveConfig:${cfg.passwordHash ? 'hasHash' : 'noHash'}`),
    hashPassword: () => 'fakesalt:fakehash',
    restartService: () => calls.push('restartService'),
    prompt: async () => ({ password: 'StrongPass1!' }),
    writeFileSync: (_path, content) => { writtenContent = content; calls.push('writeFileSync') },
    chmodSync: (_path, mode) => calls.push(`chmodSync:${mode}`),
    log: {
      dim: () => {},
      success: (msg) => calls.push(`success:${msg}`),
    },
  })

  assert.ok(calls.includes('writeFileSync'))
  assert.ok(calls.includes(`chmodSync:${0o600}`))
  assert.ok(calls.includes('saveConfig:hasHash'))
  assert.ok(calls.includes('restartService'))
  assert.ok(calls.some((c) => c.includes('Password updated')))
  assert.ok(writtenContent.includes('OPENCODE_SERVER_USERNAME=admin'))
  assert.ok(writtenContent.includes('OPENCODE_SERVER_PASSWORD=StrongPass1!'))
})

test('password command returns early when cancelled', async () => {
  const calls = []

  await password('password', [], {
    ensureSetup: () => ({ username: 'admin' }),
    prompt: async () => ({}),
    log: {
      dim: (msg) => calls.push(`dim:${msg}`),
      success: () => calls.push('success'),
    },
    saveConfig: () => calls.push('saveConfig'),
    restartService: () => calls.push('restartService'),
    hashPassword: () => 'x',
    writeFileSync: () => calls.push('writeFileSync'),
    chmodSync: () => calls.push('chmodSync'),
  })

  assert.ok(calls.some((c) => c.includes('Cancelled')))
  assert.ok(!calls.includes('writeFileSync'))
  assert.ok(!calls.includes('restartService'))
})

test('password command falls back to default username and exposes validator', async () => {
  let promptConfig
  let writtenContent = null

  await password('password', [], {
    ensureSetup: () => ({ port: 4096 }),
    prompt: async (config) => {
      promptConfig = config
      return { password: 'StrongPass1!' }
    },
    hashPassword: () => 'fakesalt:fakehash',
    writeFileSync: (_path, content) => { writtenContent = content },
    chmodSync: () => {},
    saveConfig: () => {},
    restartService: () => {},
    log: {
      dim: () => {},
      success: () => {},
    },
  })

  assert.equal(promptConfig.validate('short'), 'Minimum 8 characters, At least 1 digit, At least 1 special character (!@#$%^&* etc.)')
  assert.equal(promptConfig.validate('StrongPass1!'), true)
  assert.match(writtenContent, /^OPENCODE_SERVER_USERNAME=opencode$/m)
})
