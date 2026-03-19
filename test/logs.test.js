import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import logs, { parseLogsArgs } from '../src/commands/logs.js'

test('parseLogsArgs defaults', () => {
  const opts = parseLogsArgs([])
  assert.equal(opts.lines, 100)
  assert.equal(opts.follow, false)
  assert.equal(opts.since, null)
})

test('parseLogsArgs --lines 200', () => {
  const opts = parseLogsArgs(['--lines', '200'])
  assert.equal(opts.lines, 200)
})

test('parseLogsArgs -n 50', () => {
  const opts = parseLogsArgs(['-n', '50'])
  assert.equal(opts.lines, 50)
})

test('parseLogsArgs --follow', () => {
  const opts = parseLogsArgs(['--follow'])
  assert.equal(opts.follow, true)
})

test('parseLogsArgs -f', () => {
  const opts = parseLogsArgs(['-f'])
  assert.equal(opts.follow, true)
})

test('parseLogsArgs --since', () => {
  const opts = parseLogsArgs(['--since', '1h ago'])
  assert.equal(opts.since, '1h ago')
})

test('parseLogsArgs combined flags', () => {
  const opts = parseLogsArgs(['-f', '-n', '30', '--since', '2h ago'])
  assert.equal(opts.follow, true)
  assert.equal(opts.lines, 30)
  assert.equal(opts.since, '2h ago')
})

test('logs non-follow mode calls getLogs with parsed lines', async () => {
  const calls = []
  const originalLog = console.log
  let capturedOutput = null

  console.log = (msg) => { capturedOutput = msg }

  try {
    await logs('logs', ['--lines', '50'], {
      ensureSetup: () => calls.push('ensureSetup'),
      getLogs: (n, since) => {
        calls.push(`getLogs:${n}:${since}`)
        return 'fake log line'
      },
      spawn: () => {},
    })

    assert.deepEqual(calls, ['ensureSetup', 'getLogs:50:null'])
    assert.equal(capturedOutput, 'fake log line')
  } finally {
    console.log = originalLog
  }
})

test('logs with --since passes since to getLogs', async () => {
  const calls = []
  const originalLog = console.log
  console.log = () => {}

  try {
    await logs('logs', ['--since', '1h ago'], {
      ensureSetup: () => calls.push('ensureSetup'),
      getLogs: (n, since) => {
        calls.push(`getLogs:${n}:${since}`)
        return ''
      },
      spawn: () => {},
    })

    assert.ok(calls.includes('getLogs:100:1h ago'))
  } finally {
    console.log = originalLog
  }
})

test('logs prints helpful message when no log output is available', async () => {
  const calls = []

  await logs('logs', [], {
    ensureSetup: () => {},
    getLogs: () => '',
    spawn: () => {},
    log: {
      info: (msg) => calls.push(`info:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      warn: (msg) => calls.push(`warn:${msg}`),
      dim: () => {},
    },
  })

  assert.ok(calls.some((entry) => entry.includes('No recent logs found')))
})

test('logs rejects invalid --since value in non-follow mode', async () => {
  const calls = []

  await logs('logs', ['--since', '!!!'], {
    ensureSetup: () => {},
    getLogs: () => 'should not be called',
    spawn: () => {},
    log: {
      info: () => {},
      error: (msg) => calls.push(`error:${msg}`),
      warn: () => {},
      dim: () => {},
    },
  })

  assert.ok(calls.some((entry) => entry.includes('Invalid value for --since')))
})

test('logs follow mode reports spawn failure cleanly', async () => {
  const calls = []
  const child = new EventEmitter()
  child.on = child.addListener.bind(child)

  await logs('logs', ['-f'], {
    ensureSetup: () => {},
    getLogs: () => '',
    spawn: () => {
      queueMicrotask(() => child.emit('error', new Error('spawn failed')))
      return child
    },
    log: {
      info: () => {},
      error: (msg) => calls.push(`error:${msg}`),
      warn: (msg) => calls.push(`warn:${msg}`),
      dim: () => {},
    },
  })

  assert.ok(calls.some((entry) => entry.includes('Failed to follow logs')))
})
