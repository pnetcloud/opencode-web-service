import test from 'node:test'
import assert from 'node:assert/strict'

import publish, {
  checkNpmAuth,
  runTests,
  readPkg,
  loadEnvFile,
  extractChangelogSection,
  createGitHubRelease,
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

test('loadEnvFile parses key=value pairs and skips comments', () => {
  const vars = loadEnvFile({
    existsSync: () => true,
    readFileSync: () => '# comment\nNPM_TOKEN=tok123\nEMPTY=\nFOO=bar\n',
  })
  assert.equal(vars.NPM_TOKEN, 'tok123')
  assert.equal(vars.FOO, 'bar')
  assert.ok(!('EMPTY' in vars))
})

test('loadEnvFile returns empty object when file missing', () => {
  const vars = loadEnvFile({ existsSync: () => false })
  assert.deepEqual(vars, {})
})

function mockDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    _readPkg: () => ({ name: 'test-pkg', version: '1.0.0' }),
    _checkNpmAuth: () => 'testuser',
    _setNpmToken: (tok) => calls.push(`setToken:${tok}`),
    _loadEnvFile: () => ({}),
    _runTests: () => ({ ok: true, output: '' }),
    _dryRun: () => 'package contents...',
    _npmPublish: (tag) => calls.push(`publish:${tag || 'latest'}`),
    _bumpVersion: (type) => { calls.push(`bump:${type}`); return '1.1.0' },
    _gitTagAndCommit: (v) => { calls.push(`gitTag:${v}`); return `v${v}` },
    _gitRollbackBump: () => calls.push('gitRollback'),
    _gitPush: (tag) => calls.push(`gitPush:${tag}`),
    _extractChangelogSection: () => null,
    _createGitHubRelease: () => { calls.push('ghRelease'); return { ok: true } },
    exitProcess: (code) => calls.push(`exit:${code}`),
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'none' }
      if (opts.name === 'method') return { method: 'local' }
      if (opts.name === 'tag') return { tag: '' }
      if (opts.name === 'confirm') return { confirm: true }
      return {}
    },
    log: {
      info: () => {},
      step: () => {},
      success: (msg) => calls.push(`success:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      warn: (msg) => calls.push(`warn:${msg}`),
      dim: () => {},
    },
    ...overrides,
  }
}

test('publish happy path local: auth → test → confirm → publish', async () => {
  const deps = mockDeps()
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('publish:latest'))
  assert.ok(deps.calls.some((c) => c.includes('Published test-pkg@1.0.0')))
})

test('publish with version bump (local)', async () => {
  const deps = mockDeps({
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'minor' }
      if (opts.name === 'method') return { method: 'local' }
      if (opts.name === 'tag') return { tag: '' }
      if (opts.name === 'confirm') return { confirm: true }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('bump:minor'))
  assert.ok(deps.calls.includes('publish:latest'))
  assert.ok(deps.calls.some((c) => c.startsWith('gitTag:')))
})

test('publish CI flow: bump → tag → push → GitHub Release', async () => {
  const deps = mockDeps({
    _extractChangelogSection: () => '### Added\n- Cool feature',
    _createGitHubRelease: (tag, notes) => {
      deps.calls.push(`ghRelease:${tag}`)
      deps.calls.push(`ghNotes:${notes}`)
      return { ok: true }
    },
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'patch' }
      if (opts.name === 'method') return { method: 'ci' }
      if (opts.name === 'push') return { push: true }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('bump:patch'))
  assert.ok(deps.calls.some((c) => c.startsWith('gitTag:')))
  assert.ok(deps.calls.some((c) => c.startsWith('gitPush:')))
  assert.ok(deps.calls.some((c) => c.startsWith('ghRelease:')))
  assert.ok(deps.calls.some((c) => c.includes('Cool feature')))
  assert.ok(!deps.calls.some((c) => c.startsWith('publish:')))
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
      if (opts.name === 'method') return { method: 'local' }
      if (opts.name === 'tag') return { tag: '' }
      if (opts.name === 'confirm') return { confirm: false }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(!deps.calls.some((c) => c.startsWith('publish:')))
})

test('publish with beta tag (local)', async () => {
  const deps = mockDeps({
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'none' }
      if (opts.name === 'method') return { method: 'local' }
      if (opts.name === 'tag') return { tag: 'beta' }
      if (opts.name === 'confirm') return { confirm: true }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('publish:beta'))
})

test('publish loads NPM_TOKEN from .env and configures npm', async () => {
  const deps = mockDeps({
    _loadEnvFile: () => ({ NPM_TOKEN: 'tok_secret' }),
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'none' }
      if (opts.name === 'method') return { method: 'local' }
      if (opts.name === 'tag') return { tag: '' }
      if (opts.name === 'confirm') return { confirm: true }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('setToken:tok_secret'))
  assert.ok(deps.calls.includes('publish:latest'))
})

test('publish rollback on cancel after bump', async () => {
  const deps = mockDeps({
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'minor' }
      if (opts.name === 'method') return { method: undefined }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.includes('bump:minor'))
  assert.ok(deps.calls.includes('gitRollback'))
  assert.ok(!deps.calls.some((c) => c.startsWith('publish:')))
})

test('extractChangelogSection returns section content for given version', () => {
  const changelog = [
    '# Changelog',
    '',
    '## [2.0.0] — 2026-03-20',
    '',
    '### Added',
    '- New stuff',
    '',
    '## [1.0.0] — 2026-03-19',
    '',
    '### Fixed',
    '- Bug fix',
  ].join('\n')

  const section = extractChangelogSection('v2.0.0', {
    existsSync: () => true,
    readFileSync: () => changelog,
  })
  assert.ok(section.includes('### Added'))
  assert.ok(section.includes('New stuff'))
  assert.ok(!section.includes('Bug fix'))
})

test('extractChangelogSection returns null when version not found', () => {
  const section = extractChangelogSection('v9.9.9', {
    existsSync: () => true,
    readFileSync: () => '# Changelog\n\n## [1.0.0]\n\n- stuff',
  })
  assert.equal(section, null)
})

test('extractChangelogSection returns null when no changelog file', () => {
  const section = extractChangelogSection('v1.0.0', {
    existsSync: () => false,
  })
  assert.equal(section, null)
})

test('createGitHubRelease returns ok:true on success', () => {
  const result = createGitHubRelease('v1.0.0', '### Added\n- feature', {
    execSync: () => '',
  })
  assert.deepEqual(result, { ok: true })
})

test('createGitHubRelease returns ok:false on failure', () => {
  const result = createGitHubRelease('v1.0.0', null, {
    execSync: () => { throw new Error('gh not found') },
  })
  assert.equal(result.ok, false)
  assert.ok(result.message.includes('gh not found'))
})

test('CI flow warns when GitHub Release creation fails', async () => {
  const deps = mockDeps({
    _createGitHubRelease: () => ({ ok: false, message: 'gh not installed' }),
    prompt: async (opts) => {
      if (opts.name === 'bump') return { bump: 'patch' }
      if (opts.name === 'method') return { method: 'ci' }
      if (opts.name === 'push') return { push: true }
      return {}
    },
  })
  await publish('publish', [], deps)

  assert.ok(deps.calls.some((c) => c.includes('Could not create GitHub Release')))
  assert.ok(!deps.calls.includes('exit:1'))
})
