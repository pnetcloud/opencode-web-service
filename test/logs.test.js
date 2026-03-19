import test from 'node:test'
import assert from 'node:assert/strict'

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
