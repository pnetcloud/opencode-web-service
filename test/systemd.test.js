import test from 'node:test'
import assert from 'node:assert/strict'

import { generateUnit } from '../src/utils/systemd.js'

test('generateUnit produces a restartable user service with env file', () => {
  const unit = generateUnit('/usr/bin/opencode', {
    workdir: '/home/test/project',
    port: 3000,
    hostname: '0.0.0.0',
  }, '/home/test/.config/ocweb/env')

  assert.match(unit, /^WorkingDirectory=\/home\/test\/project$/m)
  assert.match(unit, /^ExecStart=\/usr\/bin\/opencode web --port 3000 --hostname 0\.0\.0\.0$/m)
  assert.match(unit, /^EnvironmentFile=\/home\/test\/.config\/ocweb\/env$/m)
  assert.match(unit, /^Restart=on-failure$/m)
  assert.match(unit, /^RestartSec=5$/m)
})
