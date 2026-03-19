import test from 'node:test'
import assert from 'node:assert/strict'

import publish, {
  checkNpmAuth,
  runTests,
  readPkg,
} from '../src/commands/publish.js'

test('checkNpmAuth returns username when logged in', () => {
  const result = checkNpmAuth({
    execSync: () => 'testuser\n',
  })
  assert.equal(result, 'testuser')
})

test('checkNpmAuth returns null when not logged in', () => {
  const result = checkNpmAuth({
    execSync: () => { throw new Error('ENEEDAUTH') },
  })
  assert.equal(result, null)
})

test('readPkg returns parsed package.json', () => {
  const pkg = readPkg()
  assert.equal(pkg.name, 'opencode-web-service')
  assert.ok(pkg.version)
})

test('runTests returns ok:true when tests pass', () => {
  const result = runTests({
    execSync: () => 'all passed',
  })
  assert.deepEqual(result, { ok: true, output: '' })
})

test('runTests returns ok:false when tests fail', () => {
  const err = new Error('fail')
  err.stdout = 'test output'
  const result = runTests({
    execSync: () => { throw err },
  })
  assert.equal(result.ok, false)
  assert.ok(result.output.includes('test output'))
})

function mockDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    _readPkg: () => ({ name: 'test-pkg', version: '1.0.0' }),
    _checkNpmAuth: () => 'testuser',
    _runTests: () => ({ ok: true, output: '' }),
    _dryRun: () => 'package contents...',
    _npmPublish: (tag) => calls.push(`publish:${tag || 'latest'}`),
    _bumpVersion: (type) => { calls.push(`bump:${type}`); return '1.1.0' },
    exitProcess: (code) => calls.push(`exit:${code}`),
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'none' }
      if (opts.name === 'tag') return { tag: '' }
      if (opts.name === 'confirm') return { confirm: true }
      return {}
    },
    log: {
      info: () => {},
      step: () => {},
      success: (msg) => calls.push(`success:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      dim: () => {},
    },
    ...overrides,
  }
}

test('publish happy path: auth → test → dry-run → confirm → publish', async () => {
  const deps = mockDeps()
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('publish:latest'))
  assert.ok(deps.calls.some((c) => c.includes('Published test-pkg@1.0.0')))
})

test('publish with version bump', async () => {
  const deps = mockDeps({
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'minor' }
      if (opts.name === 'tag') return { tag: '' }
      if (opts.name === 'confirm') return { confirm: true }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('bump:minor'))
  assert.ok(deps.calls.includes('publish:latest'))
})

test('publish exits when not authenticated', async () => {
  const deps = mockDeps({ _checkNpmAuth: () => null })
  await publish('publish', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('Not logged in')))
  assert.ok(deps.calls.includes('exit:1'))
  assert.ok(!deps.calls.some((c) => c.startsWith('publish:')))
})

test('publish exits when tests fail', async () => {
  const deps = mockDeps({ _runTests: () => ({ ok: false, output: 'failure' }) })
  await publish('publish', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('Tests failed')))
  assert.ok(deps.calls.includes('exit:1'))
})

test('publish cancels on declining confirmation', async () => {
  const deps = mockDeps({
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'none' }
      if (opts.name === 'tag') return { tag: '' }
      if (opts.name === 'confirm') return { confirm: false }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(!deps.calls.some((c) => c.startsWith('publish:')))
})

test('publish with beta tag', async () => {
  const deps = mockDeps({
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'none' }
      if (opts.name === 'tag') return { tag: 'beta' }
      if (opts.name === 'confirm') return { confirm: true }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('publish:beta'))
})
