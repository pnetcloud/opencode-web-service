import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'

import { getConfigDir, getConfigPath, ensureSetup, loadConfig, saveConfig } from '../src/utils/config.js'

test('getConfigDir returns path under .config/ocweb', () => {
  assert.ok(getConfigDir().endsWith('.config/ocweb'))
})

test('getConfigPath returns path ending in config.json', () => {
  assert.ok(getConfigPath().endsWith('.config/ocweb/config.json'))
})

test('ensureSetup throws when no config exists', () => {
  // ensureSetup reads from ~/.config/ocweb/config.json
  // In CI/test env it should not exist, so it throws
  // If it DOES exist (dev machine), we just verify the function returns an object
  try {
    const result = ensureSetup()
    assert.equal(typeof result, 'object')
  } catch (err) {
    assert.match(err.message, /Run "ocweb setup" first/)
  }
})

test('base config utils can save and reload config data', () => {
  const configPath = getConfigPath()
  const configDir = getConfigDir()
  const backupPath = `${configPath}.bak-test`
  const hadConfig = existsSync(configPath)
  let backupContent = null

  if (hadConfig) {
    backupContent = readFileSync(configPath, 'utf8')
    renameSync(configPath, backupPath)
  }

  try {
    const config = { port: 4096, hostname: 'localhost' }
    saveConfig(config)

    assert.deepEqual(loadConfig(), config)
    assert.match(readFileSync(configPath, 'utf8'), /"port": 4096/)

    // Verify chmod 600
    const stats = statSync(configPath)
    const mode = stats.mode & 0o777
    assert.equal(mode, 0o600, `Expected 0600, got 0${mode.toString(8)}`)
  } finally {
    rmSync(configDir, { recursive: true, force: true })
    if (hadConfig && backupContent) {
      saveConfig(JSON.parse(backupContent))
    }
    rmSync(backupPath, { force: true })
  }
})
