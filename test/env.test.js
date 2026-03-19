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
  assert.ok(!content.includes('NGROK_AUTHTOKEN'), 'should not include ngrok token when not provided')
})

test('buildEnvFileContent includes NGROK_AUTHTOKEN when provided', () => {
  const content = buildEnvFileContent({
    username: 'opencode',
    password: 'StrongPass1!',
    ngrokAuthtoken: 'tok_abc123',
  })

  assert.match(content, /^OPENCODE_SERVER_USERNAME=opencode$/m)
  assert.match(content, /^OPENCODE_SERVER_PASSWORD=StrongPass1!$/m)
  assert.match(content, /^NGROK_AUTHTOKEN=tok_abc123$/m)
})
