import test from 'node:test'
import assert from 'node:assert/strict'

import { buildEnvFileContent } from '../src/utils/env.js'

test('buildEnvFileContent includes username and password only', () => {
  const content = buildEnvFileContent({
    username: 'opencode',
    password: 'StrongPass1!',
  })

  assert.match(content, /^OPENCODE_SERVER_USERNAME=opencode$/m)
  assert.match(content, /^OPENCODE_SERVER_PASSWORD=StrongPass1!$/m)
  assert.ok(!content.includes('OCWEB_PASSWORD_HASH'), 'hash must NOT be in env file')
})
