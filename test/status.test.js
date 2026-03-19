import test from 'node:test'
import assert from 'node:assert/strict'

import { buildStatusLines, formatUptime } from '../src/commands/status.js'

test('formatUptime renders multi-unit durations', () => {
  const now = Date.parse('2026-03-18T12:00:00Z')
  const startedAt = 'Wed 2026-03-18 10:29:30 UTC'

  assert.equal(formatUptime(startedAt, now), '1h 30m 30s')
})

test('buildStatusLines includes uptime and url for active service', () => {
  const output = buildStatusLines(
    { hostname: 'localhost', port: 3000 },
    {
      active: true,
      subState: 'running',
      pid: '1234',
      startedAt: 'Wed 2026-03-18 10:29:30 UTC',
    },
    {},
    Date.parse('2026-03-18T12:00:00Z')
  )

  assert.equal(output.level, 'success')
  assert.ok(output.lines.includes('Service active (running)'))
  assert.ok(output.lines.includes('PID: 1234'))
  assert.ok(output.lines.includes('Uptime: 1h 30m 30s'))
  assert.ok(output.lines.includes('URL: http://localhost:3000'))
})

test('buildStatusLines reports inactive service', () => {
  const output = buildStatusLines({ hostname: 'localhost', port: 3000 }, {
    active: false,
    state: 'inactive',
  })

  assert.equal(output.level, 'warn')
  assert.ok(output.lines.includes('Service inactive (inactive)'))
  assert.ok(output.lines.includes('URL: http://localhost:3000'))
})

test('formatUptime returns null for missing or invalid timestamps', () => {
  assert.equal(formatUptime(null), null)
  assert.equal(formatUptime('not-a-date'), null)
})

test('formatUptime omits seconds when duration is exact minute', () => {
  const now = Date.parse('2026-03-18T12:00:00Z')
  const startedAt = 'Wed 2026-03-18 11:59:00 UTC'

  assert.equal(formatUptime(startedAt, now), '1m')
})

test('buildStatusLines skips pid and uptime when active status lacks them', () => {
  const output = buildStatusLines(
    { hostname: 'localhost', port: 3000 },
    { active: true, subState: 'running', pid: null, startedAt: 'bad-date' },
    {},
    Date.parse('2026-03-18T12:00:00Z')
  )

  assert.ok(output.lines.includes('Service active (running)'))
  assert.ok(output.lines.includes('URL: http://localhost:3000'))
  assert.ok(!output.lines.some((l) => l.includes('PID')))
})

test('buildStatusLines includes extra info when provided', () => {
  const output = buildStatusLines(
    { hostname: 'localhost', port: 3000 },
    { active: true, subState: 'running', pid: null, startedAt: null },
    { unitInstalled: true, timerEnabled: false, configDir: '/home/test/.config/ocweb' }
  )

  assert.ok(output.lines.includes('Unit installed: yes'))
  assert.ok(output.lines.includes('Upgrade timer: not configured'))
  assert.ok(output.lines.includes('Config: /home/test/.config/ocweb'))
})
