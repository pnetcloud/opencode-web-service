import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSystemctlShow } from '../src/utils/systemd.js'

test('parseSystemctlShow maps systemctl properties into status object', () => {
  const status = parseSystemctlShow(`ActiveState=active
SubState=running
MainPID=4321
ExecMainStartTimestamp=Wed 2026-03-18 10:29:30 UTC
`)

  assert.deepEqual(status, {
    active: true,
    state: 'active',
    subState: 'running',
    pid: '4321',
    startedAt: 'Wed 2026-03-18 10:29:30 UTC',
  })
})

test('parseSystemctlShow normalizes missing process info', () => {
  const status = parseSystemctlShow(`
ActiveState=inactive
SubState=dead
MainPID=0
`)

  assert.deepEqual(status, {
    active: false,
    state: 'inactive',
    subState: 'dead',
    pid: null,
    startedAt: null,
  })
})
