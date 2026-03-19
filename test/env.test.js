import test from 'node:test'
import assert from 'node:assert/strict'

import { buildEnvFileContent, parseEnvContent, parseEnvFile } from '../src/utils/env.js'

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

test('parseEnvContent parses key=value pairs', () => {
  const result = parseEnvContent('FOO=bar\nBAZ=qux\n')
  assert.deepEqual(result, { FOO: 'bar', BAZ: 'qux' })
})

test('parseEnvContent skips comments and blank lines', () => {
  const result = parseEnvContent('# comment\n\nFOO=bar\n  \n# another\nBAZ=qux')
  assert.deepEqual(result, { FOO: 'bar', BAZ: 'qux' })
})

test('parseEnvContent handles values with = signs', () => {
  const result = parseEnvContent('TOKEN=abc=def=ghi\n')
  assert.deepEqual(result, { TOKEN: 'abc=def=ghi' })
})

test('parseEnvContent skips lines without value', () => {
  const result = parseEnvContent('NOVALUE=\nGOOD=yes\n')
  assert.deepEqual(result, { GOOD: 'yes' })
})

test('parseEnvFile returns empty object on missing file', () => {
  const result = parseEnvFile('/nonexistent/path', {
    readFileSyncFn: () => { throw new Error('ENOENT') },
  })
  assert.deepEqual(result, {})
})

test('parseEnvFile reads and parses file', () => {
  const result = parseEnvFile('/tmp/test.env', {
    readFileSyncFn: () => 'KEY=value\nOTHER=stuff\n',
  })
  assert.deepEqual(result, { KEY: 'value', OTHER: 'stuff' })
})
