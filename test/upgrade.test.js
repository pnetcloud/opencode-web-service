import test from 'node:test'
import assert from 'node:assert/strict'

import upgrade, { createUpgradeTimer, cronToSystemdOnCalendar, quoteShellArg, resolveOcwebPath } from '../src/commands/upgrade.js'

test('cronToSystemdOnCalendar converts simple cron schedule to systemd format', () => {
  assert.equal(cronToSystemdOnCalendar('0 3 * * *'), '*-*-* 03:00:00')
  assert.equal(cronToSystemdOnCalendar('0 2 * * 0'), 'Sun *-*-* 02:00:00')
})

test('cronToSystemdOnCalendar supports step expressions (*/N)', () => {
  const result = cronToSystemdOnCalendar('*/15 * * * *')
  assert.match(result, /00\/15/)
})

test('cronToSystemdOnCalendar supports range expressions (N-M)', () => {
  const result = cronToSystemdOnCalendar('0 9-17 * * *')
  assert.match(result, /09\.\.17/)
})

test('cronToSystemdOnCalendar supports list expressions (N,M,K)', () => {
  const result = cronToSystemdOnCalendar('0 3 1,15 * *')
  assert.match(result, /01,15/)
})

test('cronToSystemdOnCalendar rejects invalid expressions', () => {
  assert.throws(() => cronToSystemdOnCalendar('0 3 * *'), /5-field cron expression/)
  assert.throws(() => cronToSystemdOnCalendar('60 3 * * *'), /Minute must be between 0 and 59/)
  assert.throws(() => cronToSystemdOnCalendar('0 25 * * *'), /Hour must be between 0 and 23/)
  assert.throws(() => cronToSystemdOnCalendar('0 3 0 * *'), /Day of month must be between 1 and 31/)
  assert.throws(() => cronToSystemdOnCalendar('0 3 * 13 *'), /Month must be between 1 and 12/)
  assert.throws(() => cronToSystemdOnCalendar('0 3 * * 9'), /Day of week must be between 0 and 7/)
})

test('cronToSystemdOnCalendar rejects completely invalid syntax', () => {
  assert.throws(() => cronToSystemdOnCalendar('abc def ghi jkl mno'), /Invalid cron field/)
})

test('quoteShellArg only quotes unsafe values', () => {
  assert.equal(quoteShellArg('/usr/bin/opencode'), '/usr/bin/opencode')
  assert.equal(quoteShellArg('/path with spaces/opencode'), "'/path with spaces/opencode'")
})

test('resolveOcwebPath uses which output or falls back to argv', () => {
  assert.equal(resolveOcwebPath({ execSync: () => '/usr/bin/ocweb\n' }), '/usr/bin/ocweb')
  assert.equal(resolveOcwebPath({ execSync: () => { throw new Error('missing') }, argv: ['node', '/tmp/ocweb'] }), '/tmp/ocweb')
})

test('createUpgradeTimer writes timer and service units with quoted path', () => {
  const writes = []
  const dirs = []

  createUpgradeTimer('0 3 * * *', {
    mkdirSync: (path, options) => dirs.push({ path, options }),
    writeFileSync: (path, content) => writes.push({ path, content }),
    resolveOcweb: () => '/usr/bin/ocweb',
  })

  assert.equal(dirs.length, 1)
  assert.equal(writes.length, 2)
  assert.match(writes[0].content, /OnCalendar=\*-\*-\* 03:00:00/)
  assert.match(writes[1].content, /ExecStart=\/usr\/bin\/ocweb upgrade/)
})

test('createUpgradeTimer uses default ocweb resolver when dependency not provided', () => {
  const writes = []

  createUpgradeTimer('0 3 * * *', {
    execSync: () => '/usr/local/bin/ocweb\n',
    mkdirSync: () => {},
    writeFileSync: (path, content) => writes.push({ path, content }),
  })

  assert.match(writes[1].content, /ExecStart=\/usr\/local\/bin\/ocweb upgrade/)
})

test('upgrade uses configured opencode binary for manual upgrade', async () => {
  const calls = []

  await upgrade('upgrade', [], {
    ensureSetup: () => ({ opencodePath: '/opt/opencode/bin/opencode' }),
    stopService: () => calls.push('stopService'),
    startService: () => calls.push('startService'),
    execSync: (command) => calls.push(command),
    log: {
      step: () => {},
      success: () => {},
      error: () => {},
      warn: () => {},
      dim: () => {},
    },
    exitProcess: (code) => {
      throw new Error(`unexpected exit ${code}`)
    },
  })

  assert.deepEqual(calls, [
    'stopService',
    '/opt/opencode/bin/opencode upgrade',
    'startService',
  ])
})

test('upgrade logs failure when rollback restart also fails', async () => {
  const calls = []

  await upgrade('upgrade', [], {
    ensureSetup: () => ({ opencodePath: '/opt/opencode/bin/opencode' }),
    stopService: () => calls.push('stopService'),
    startService: () => { throw new Error('cannot restart') },
    execSync: () => { throw new Error('download failed') },
    log: {
      step: (msg) => calls.push(`step:${msg}`),
      success: (msg) => calls.push(`success:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      warn: (msg) => calls.push(`warn:${msg}`),
      dim: () => {},
    },
    exitProcess: (code) => calls.push(`exit:${code}`),
  })

  assert.ok(calls.includes('error:Failed to restart service'))
  assert.ok(calls.includes('exit:1'))
})

test('upgrade falls back to resolved opencode path when config lacks it', async () => {
  const calls = []

  await upgrade('upgrade', [], {
    ensureSetup: () => ({}),
    stopService: () => calls.push('stopService'),
    startService: () => calls.push('startService'),
    execSync: (command) => {
      if (command === 'which ocweb') return '/usr/bin/ocweb\n'
      calls.push(command)
      return ''
    },
    log: {
      step: () => {},
      success: () => {},
      error: () => {},
      warn: () => {},
      dim: () => {},
    },
    exitProcess: () => {},
  })

  assert.ok(calls.includes('/usr/bin/ocweb upgrade'))
})
