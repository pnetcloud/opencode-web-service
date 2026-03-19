import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function loadConfigModule(homeDir) {
  const originalHome = process.env.HOME
  process.env.HOME = homeDir
  try {
    return await import(new URL(`../src/utils/config.js?home=${encodeURIComponent(homeDir)}&t=${Date.now()}`, import.meta.url))
  } finally {
    process.env.HOME = originalHome
  }
}

test('config utils save, load, and ensure config from filesystem', async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'ocweb-config-'))

  try {
    const mod = await loadConfigModule(homeDir)

    assert.equal(mod.loadConfig(), null)
    assert.ok(mod.getConfigDir().endsWith('.config/ocweb'))
    assert.ok(mod.getConfigPath().endsWith('.config/ocweb/config.json'))
    assert.throws(() => mod.ensureSetup({ loadConfigFn: () => null }), /Run "ocweb setup" first/)

    const config = { port: 4096, hostname: 'localhost' }
    mod.saveConfig(config)

    assert.deepEqual(mod.loadConfig(), config)

    // Verify ensureSetup with DI
    const result = mod.ensureSetup({
      loadConfigFn: () => config,
      existsSyncFn: () => true,
      accessSyncFn: () => {},
    })
    assert.equal(result.port, 4096)
    assert.deepEqual(result._warnings, [])
  } finally {
    rmSync(homeDir, { recursive: true, force: true })
  }
})

test('saveConfig sets file permissions to 0600', async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'ocweb-config-chmod-'))

  try {
    const mod = await loadConfigModule(homeDir)
    mod.saveConfig({ port: 4096 })

    const configPath = mod.getConfigPath()
    const stats = statSync(configPath)
    const mode = stats.mode & 0o777
    assert.equal(mode, 0o600, `Expected 0600, got 0${mode.toString(8)}`)
  } finally {
    rmSync(homeDir, { recursive: true, force: true })
  }
})

test('ensureSetup reports warnings for missing env and unreachable binary', async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'ocweb-config-warn-'))

  try {
    const mod = await loadConfigModule(homeDir)

    const result = mod.ensureSetup({
      loadConfigFn: () => ({ port: 4096, opencodePath: '/nonexistent/opencode' }),
      existsSyncFn: () => false,
      accessSyncFn: () => { throw new Error('not found') },
    })

    assert.equal(result._warnings.length, 2)
    assert.ok(result._warnings[0].includes('Environment file missing'))
    assert.ok(result._warnings[1].includes('opencode not found'))
  } finally {
    rmSync(homeDir, { recursive: true, force: true })
  }
})
