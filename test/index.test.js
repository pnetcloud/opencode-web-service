import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CLI_PATH = fileURLToPath(new URL('../src/index.js', import.meta.url))
const PKG_VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version

// Force NO_COLOR to strip ANSI from output for easier assertions
const env = { ...process.env, NO_COLOR: '1' }

test('cli prints version', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, '--version'], {
    encoding: 'utf8',
    env,
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, new RegExp(`^${PKG_VERSION}\\s*$`))
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

test('cli help includes doctor and hides publish from end-user help', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, '--help'], {
    encoding: 'utf8',
    env,
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /doctor/)
  assert.doesNotMatch(result.stdout, /Publish package to npm/)
})
