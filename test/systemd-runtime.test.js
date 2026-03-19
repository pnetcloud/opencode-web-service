import test from 'node:test'
import assert from 'node:assert/strict'

import {
  daemonReload,
  enableService,
  startService,
  stopService,
  restartService,
  disableService,
  getStatus,
  getLogs,
  enableLinger,
  isUnitInstalled,
} from '../src/utils/systemd.js'

test('systemd helpers execute expected commands', () => {
  const commands = []
  const deps = {
    execSyncFn: (cmd, opts) => {
      commands.push({ cmd, opts })
      if (cmd.includes('show')) {
        return 'ActiveState=active\nSubState=running\nMainPID=123\nExecMainStartTimestamp=Wed 2026-03-18 10:29:30 UTC\n'
      }
      if (cmd.includes('journalctl')) {
        return 'log line'
      }
      return 'ok\n'
    },
    userInfoFn: () => ({ username: 'alice' }),
  }

  daemonReload(deps)
  enableService(deps)
  startService(deps)
  stopService(deps)
  restartService(deps)
  disableService(deps)
  assert.deepEqual(getStatus(deps), {
    active: true,
    state: 'active',
    subState: 'running',
    pid: '123',
    startedAt: 'Wed 2026-03-18 10:29:30 UTC',
  })
  assert.equal(getLogs(50, null, deps), 'log line')
  enableLinger(deps)
  assert.equal(isUnitInstalled(deps), true)

  const issued = commands.map(({ cmd }) => cmd)
  assert.ok(issued.includes('systemctl --user daemon-reload'))
  assert.ok(issued.includes('systemctl --user enable ocweb.service'))
  assert.ok(issued.includes('systemctl --user start ocweb.service'))
  assert.ok(issued.includes('systemctl --user stop ocweb.service'))
  assert.ok(issued.includes('systemctl --user restart ocweb.service'))
  assert.ok(issued.includes('systemctl --user disable ocweb.service'))
  assert.ok(issued.includes('journalctl --user -u ocweb.service -n 50 --no-pager'))
  assert.ok(issued.includes('loginctl enable-linger alice'))
  assert.ok(issued.includes('systemctl --user cat ocweb.service'))
})

test('systemd helpers handle show/cat failures', () => {
  const deps = {
    execSyncFn: (cmd) => {
      if (cmd.includes('show') || cmd.includes('cat')) {
        throw new Error('failed')
      }
      return 'ok\n'
    },
  }

  assert.deepEqual(getStatus(deps), {
    active: false,
    state: 'unknown',
    subState: 'unknown',
    pid: null,
    startedAt: null,
  })
  assert.equal(isUnitInstalled(deps), false)
})
