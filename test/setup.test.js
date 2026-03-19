import test from 'node:test'
import assert from 'node:assert/strict'

import setup, { findOpencode, findNode } from '../src/commands/setup.js'

// Smart mock prompt that handles all setup wizard flows
function smartPrompt(overrides = {}) {
  return async (config) => {
    // Reconfigure confirm
    if (!Array.isArray(config) && config.name === 'confirm') {
      return overrides.confirm ?? { confirm: true }
    }
    // Mode selection (select type)
    if (!Array.isArray(config) && config.name === 'mode') {
      return overrides.mode ?? { mode: 'local' }
    }
    // Ngrok authtoken keep/change
    if (!Array.isArray(config) && config.name === 'keepToken') {
      return overrides.keepToken ?? { keepToken: true }
    }
    // Ngrok authtoken entry
    if (!Array.isArray(config) && config.name === 'authtoken') {
      return overrides.authtoken ?? { authtoken: 'ngrok_test_token_12345' }
    }
    // Keep existing credentials
    if (!Array.isArray(config) && config.name === 'keepCreds') {
      return overrides.keepCreds ?? { keepCreds: false }
    }
    // Main wizard questions (array)
    if (Array.isArray(config)) {
      if (overrides.mainQuestions) return overrides.mainQuestions(config)
      return {
        port: '4096',
        hostname: 'localhost',
        workdir: '/tmp/test',
        username: 'admin',
        password: 'StrongPass1!',
      }
    }
    return {}
  }
}

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
    restartService: () => calls.push('restartService'),
    enableLinger: () => calls.push('enableLinger'),
    generateUnit: () => 'unit-content',
    generateTunnelUnit: () => 'tunnel-unit-content',
    prompt: smartPrompt(),
    parseEnvFileFn: () => ({}),
    existsSync: () => true,
    accessSync: () => {},
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
    _findNode: () => '/usr/bin/node',
    _getTunnelServerPath: () => '/usr/lib/tunnel-server.js',
    importNgrok: async () => ({}),
    getLogs: () => '',
    sleepMs: () => Promise.resolve(),
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

test('setup cancels when user aborts mode prompt', async () => {
  const deps = mockDeps({
    prompt: smartPrompt({ mode: {} }),
  })
  await setup('setup', [], deps)

  assert.ok(deps.calls.includes('exit:0'))
  assert.ok(!deps.calls.includes('writeFileSync'))
})

test('setup asks to reconfigure when config exists', async () => {
  const dimCalls = []
  const deps = mockDeps({
    loadConfig: () => ({ port: 4096 }),
    prompt: smartPrompt({ confirm: { confirm: false } }),
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
      if (!Array.isArray(config) && config.name === 'confirm') return { confirm: true }
      if (!Array.isArray(config) && config.name === 'mode') return { mode: 'local' }
      if (!Array.isArray(config) && config.name === 'keepCreds') return { keepCreds: false }
      return {
        port: '4096',
        hostname: 'localhost',
        workdir: '/tmp/test',
        username: 'admin',
        password: 'StrongPass1!',
      }
    },
  })

  await setup('setup', [], deps)

  assert.ok(deps.calls.includes('restartService'), 'should restart, not start, when reconfiguring')
  assert.ok(!deps.calls.includes('startService'), 'should not call start when reconfiguring')
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
  let mainQuestions

  const deps = mockDeps({
    prompt: async (config) => {
      if (!Array.isArray(config) && config.name === 'mode') return { mode: 'local' }
      if (!Array.isArray(config) && config.name === 'keepCreds') return { keepCreds: false }
      if (Array.isArray(config)) {
        mainQuestions = config
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

  // Port validator is at index 0
  assert.equal(mainQuestions[0].validate('70000'), 'Port must be 1-65535')
  assert.equal(mainQuestions[0].validate('4096'), true)

  // Find password question
  const pwdQuestion = mainQuestions.find(q => q.name === 'password')
  assert.ok(pwdQuestion, 'should have password question')
  assert.equal(pwdQuestion.validate('short'), 'Minimum 8 characters, At least 1 digit, At least 1 special character (!@#$%^&* etc.)')
  assert.equal(pwdQuestion.validate('StrongPass1!'), true)

  assert.equal(warnings.length, 2)
})

// === Ngrok mode tests ===

test('setup with ngrok mode generates tunnel unit and saves mode', async () => {
  const calls = []
  let savedConfig
  const deps = mockDeps({
    prompt: smartPrompt({ mode: { mode: 'ngrok' } }),
    saveConfig: (cfg) => { savedConfig = cfg; calls.push('saveConfig') },
    writeFileSync: (path, content) => {
      if (typeof content === 'string' && content.includes('ngrok tunnel')) {
        calls.push('tunnelUnit')
      }
    },
    generateTunnelUnit: () => '[Unit]\nDescription=ngrok tunnel\n',
    getLogs: () => 'Public URL: https://abc123.ngrok-free.app\n',
  })

  await setup('setup', [], deps)

  assert.ok(calls.includes('tunnelUnit'), 'should write tunnel unit')
  assert.equal(savedConfig.mode, 'ngrok')
  assert.equal(savedConfig.hostname, '127.0.0.1', 'ngrok mode forces hostname to 127.0.0.1')
})

test('setup with ngrok mode includes authtoken in env file', async () => {
  let envContent
  const deps = mockDeps({
    prompt: smartPrompt({ mode: { mode: 'ngrok' } }),
    writeFileSync: (path, content) => {
      if (typeof content === 'string' && content.includes('NGROK_AUTHTOKEN')) {
        envContent = content
      }
    },
  })

  await setup('setup', [], deps)

  assert.ok(envContent, 'env file should contain NGROK_AUTHTOKEN')
  assert.ok(envContent.includes('NGROK_AUTHTOKEN=ngrok_test_token_12345'))
})

test('setup with local mode generates standard unit', async () => {
  const calls = []
  let savedConfig
  const deps = mockDeps({
    saveConfig: (cfg) => { savedConfig = cfg },
    writeFileSync: (path, content) => {
      if (content === 'unit-content') {
        calls.push('standardUnit')
      }
    },
  })

  await setup('setup', [], deps)

  assert.ok(calls.includes('standardUnit'), 'should write standard unit')
  assert.equal(savedConfig.mode, 'local')
})

test('setup ngrok mode skips hostname prompt', async () => {
  let mainQuestionNames = []
  const deps = mockDeps({
    prompt: async (config) => {
      if (!Array.isArray(config) && config.name === 'mode') return { mode: 'ngrok' }
      if (!Array.isArray(config) && config.name === 'authtoken') return { authtoken: 'tok_12345678901' }
      if (!Array.isArray(config) && config.name === 'keepCreds') return { keepCreds: false }
      if (Array.isArray(config)) {
        mainQuestionNames = config.map(q => q.name)
        return {
          port: '4096',
          workdir: '/tmp/test',
          username: 'admin',
          password: 'StrongPass1!',
        }
      }
      return {}
    },
  })

  await setup('setup', [], deps)

  assert.ok(!mainQuestionNames.includes('hostname'), 'ngrok mode should not ask for hostname')
  assert.ok(mainQuestionNames.includes('port'), 'should still ask for port')
})

test('setup ngrok mode reuses existing authtoken from env file', async () => {
  let keepTokenAsked = false
  let savedConfig
  const deps = mockDeps({
    parseEnvFileFn: () => ({ OPENCODE_SERVER_USERNAME: 'admin', OPENCODE_SERVER_PASSWORD: 'StrongPass1!', NGROK_AUTHTOKEN: 'existing_token_12345' }),
    prompt: async (config) => {
      if (!Array.isArray(config) && config.name === 'mode') return { mode: 'ngrok' }
      if (!Array.isArray(config) && config.name === 'keepToken') {
        keepTokenAsked = true
        return { keepToken: true }
      }
      if (!Array.isArray(config) && config.name === 'keepCreds') return { keepCreds: false }
      if (Array.isArray(config)) {
        return {
          port: '4096',
          workdir: '/tmp/test',
          username: 'admin',
          password: 'StrongPass1!',
        }
      }
      return {}
    },
    saveConfig: (cfg) => { savedConfig = cfg },
  })

  await setup('setup', [], deps)

  assert.ok(keepTokenAsked, 'should ask whether to keep existing token')
  assert.equal(savedConfig.mode, 'ngrok')
})

test('setup reuses credentials when keepCreds is true', async () => {
  let savedConfig
  let envContent
  let mainQuestionNames = []
  const deps = mockDeps({
    loadConfig: () => ({ port: 4096, hostname: 'localhost', workdir: '/tmp/test' }),
    parseEnvFileFn: () => ({ OPENCODE_SERVER_USERNAME: 'myuser', OPENCODE_SERVER_PASSWORD: 'ExistingPass1!' }),
    prompt: async (config) => {
      if (!Array.isArray(config) && config.name === 'confirm') return { confirm: true }
      if (!Array.isArray(config) && config.name === 'mode') return { mode: 'local' }
      if (!Array.isArray(config) && config.name === 'keepCreds') return { keepCreds: true }
      if (Array.isArray(config)) {
        mainQuestionNames = config.map(q => q.name)
        return {
          port: '4096',
          hostname: 'localhost',
          workdir: '/tmp/test',
        }
      }
      return {}
    },
    saveConfig: (cfg) => { savedConfig = cfg },
    writeFileSync: (_path, content) => {
      if (typeof content === 'string' && content.includes('OPENCODE_SERVER_USERNAME')) {
        envContent = content
      }
    },
  })

  await setup('setup', [], deps)

  assert.ok(!mainQuestionNames.includes('username'), 'should not ask for username when keeping creds')
  assert.ok(!mainQuestionNames.includes('password'), 'should not ask for password when keeping creds')
  assert.ok(envContent.includes('OPENCODE_SERVER_USERNAME=myuser'))
  assert.ok(envContent.includes('OPENCODE_SERVER_PASSWORD=ExistingPass1!'))
  assert.equal(savedConfig.username, 'myuser')
})

test('setup ngrok shows public URL from logs', async () => {
  const successMsgs = []
  const deps = mockDeps({
    prompt: smartPrompt({ mode: { mode: 'ngrok' } }),
    getLogs: () => 'Some output\n  Public URL: https://abc123.ngrok-free.app\n  Backend: http://127.0.0.1:4096',
    log: {
      ...mockDeps().log,
      success: (msg) => successMsgs.push(msg),
    },
  })

  await setup('setup', [], deps)

  assert.ok(successMsgs.some(m => m.includes('https://abc123.ngrok-free.app')), 'should display ngrok URL')
})

test('findNode returns node path from which', () => {
  const result = findNode({
    execSync: () => '/usr/bin/node\n',
  })
  assert.equal(result, '/usr/bin/node')
})

test('findNode falls back to process.execPath', () => {
  const result = findNode({
    execSync: () => { throw new Error('not found') },
  })
  assert.equal(result, process.execPath)
})

test('setup stops before writing files when preflight fails', async () => {
  const deps = mockDeps({
    execSync: (cmd) => {
      if (cmd === 'which systemctl') {
        throw new Error('missing systemctl')
      }
      return '/usr/bin/tool\n'
    },
  })

  await setup('setup', [], deps)

  assert.ok(deps.calls.includes('exit:1'))
  assert.ok(!deps.calls.includes('writeFileSync'))
  assert.ok(!deps.calls.includes('startService'))
})

test('setup completes non-interactively when all required flags are provided', async () => {
  let promptCalled = false
  const deps = mockDeps({
    prompt: async () => {
      promptCalled = true
      return {}
    },
  })

  await setup('setup', [
    '--mode', 'local',
    '--port', '4096',
    '--hostname', 'localhost',
    '--workdir', '/tmp/test',
    '--username', 'admin',
    '--password', 'StrongPass1!',
  ], deps)

  assert.equal(promptCalled, false)
  assert.ok(deps.calls.includes('startService'))
})

test('setup rejects incomplete non-interactive flags', async () => {
  const deps = mockDeps()

  await setup('setup', [
    '--non-interactive',
    '--mode', 'local',
    '--port', '4096',
  ], deps)

  assert.ok(deps.calls.includes('exit:1'))
  assert.ok(!deps.calls.includes('writeFileSync'))
})

test('setup non-interactively reuses env credentials without existing config', async () => {
  let promptCalled = false
  const deps = mockDeps({
    parseEnvFileFn: () => ({
      OPENCODE_SERVER_USERNAME: 'saveduser',
      OPENCODE_SERVER_PASSWORD: 'StrongPass1!',
    }),
    prompt: async () => {
      promptCalled = true
      return {}
    },
  })

  await setup('setup', [
    '--mode', 'local',
    '--port', '4096',
    '--hostname', 'localhost',
    '--workdir', '/tmp/test',
  ], deps)

  assert.equal(promptCalled, false)
  assert.ok(deps.calls.includes('startService'))
})

test('setup rejects partial credential overrides in non-interactive mode', async () => {
  const deps = mockDeps({
    parseEnvFileFn: () => ({
      OPENCODE_SERVER_USERNAME: 'saveduser',
      OPENCODE_SERVER_PASSWORD: 'StrongPass1!',
    }),
  })

  await setup('setup', [
    '--mode', 'local',
    '--port', '4096',
    '--hostname', 'localhost',
    '--workdir', '/tmp/test',
    '--username', 'override',
  ], deps)

  assert.ok(deps.calls.includes('exit:1'))
  assert.ok(!deps.calls.includes('writeFileSync'))
})
