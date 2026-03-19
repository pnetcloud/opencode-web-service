import test from 'node:test'
import assert from 'node:assert/strict'

import { log } from '../src/utils/output.js'

test('output helpers write to console with all levels', () => {
  const messages = []
  const errors = []
  const originalLog = console.log
  const originalError = console.error

  console.log = (msg) => messages.push(msg)
  console.error = (msg) => errors.push(msg)

  try {
    log.success('ok')
    log.error('bad')
    log.warn('warn')
    log.info('info')
    log.step('step')
    log.dim('dim')
  } finally {
    console.log = originalLog
    console.error = originalError
  }

  assert.equal(messages.length, 5)
  assert.equal(errors.length, 1)
  assert.match(messages.join('\n'), /ok/)
  assert.match(errors[0], /bad/)
})
