import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

test('package metadata and npmignore are publish-ready', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const npmignore = readFileSync(new URL('../.npmignore', import.meta.url), 'utf8')

  assert.equal(pkg.name, 'opencode-web-service')
  assert.equal(typeof pkg.version, 'string')
  assert.equal(typeof pkg.description, 'string')
  assert.equal(pkg.license, 'MIT')
  assert.equal(pkg.repository.type, 'git')
  assert.equal(pkg.bin.ocweb, './src/index.js')
  assert.equal(pkg.engines.node, '>=22')
  assert.ok(Array.isArray(pkg.files) && pkg.files.includes('src/'))
  assert.ok(Array.isArray(pkg.keywords) && pkg.keywords.length > 0)

  for (const line of ['*', '!src/**', '!README.md', '!README.*.md', '!LICENSE', '!package.json']) {
    assert.match(npmignore, new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
  }
})

test('package can be executed through local npx resolution', () => {
  const result = spawnSync('npx', ['--yes', '--package', 'file:.', 'opencode-web-service', '--version'], {
    cwd: root,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0)
  assert.equal(result.error, undefined)
})
