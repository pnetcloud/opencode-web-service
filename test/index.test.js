import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CLI_PATH = fileURLToPath(new URL('../src/index.js', import.meta.url))

// Force NO_COLOR to strip ANSI from output for easier assertions
const env = { ...process.env, NO_COLOR: '1' }

test('cli prints version', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, '--version'], {
    encoding: 'utf8',
    env,
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /^0\.1\.0\s*$/)
})

test('cli rejects unknown commands', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'badcommand'], {
    encoding: 'utf8',
    env,
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unknown command: badcommand/)
  assert.match(result.stdout, /Usage:.*ocweb/)
})
