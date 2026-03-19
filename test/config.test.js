import test from 'node:test'
import assert from 'node:assert/strict'

import { buildConfigLines, normalizeConfigValue } from '../src/commands/config.js'

test('buildConfigLines always includes schedule field', () => {
  assert.deepEqual(buildConfigLines({
    port: 3000,
    hostname: 'localhost',
    workdir: '/tmp/workdir',
    username: 'opencode',
  }), [
    'Mode:       local',
    'Port:       3000',
    'Hostname:   localhost',
    'Workdir:    /tmp/workdir',
    'Username:   opencode',
    'Auto-update: not configured',
  ])
})

test('normalizeConfigValue validates port range', () => {
  assert.equal(normalizeConfigValue('port', '5000'), 5000)
  assert.throws(() => normalizeConfigValue('port', '70000'), /Port must be an integer between 1 and 65535/)
})

test('normalizeConfigValue returns non-port values unchanged', () => {
  assert.equal(normalizeConfigValue('hostname', '0.0.0.0'), '0.0.0.0')
})

test('buildConfigLines shows configured auto-update schedule', () => {
  assert.equal(
    buildConfigLines({
      port: 3000,
      hostname: 'localhost',
      workdir: '/tmp/workdir',
      username: 'opencode',
      upgradeSchedule: '0 3 * * *',
    })[5],
    'Auto-update: 0 3 * * *'
  )
})

test('buildConfigLines falls back to default username', () => {
  assert.equal(
    buildConfigLines({
      port: 3000,
      hostname: 'localhost',
      workdir: '/tmp/workdir',
    })[4],
    'Username:   opencode'
  )
})
