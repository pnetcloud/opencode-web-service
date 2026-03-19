import test from 'node:test'
import assert from 'node:assert/strict'

import doctor, { collectDoctorChecks, summarizeDoctorChecks } from '../src/commands/doctor.js'

function createDeps(overrides = {}) {
  const calls = []
  return {
    calls,
    execSync: (cmd) => {
      if (cmd.startsWith('which ')) {
        return `/usr/bin/${cmd.slice(6)}\n`
      }
      return ''
    },
    loadConfig: () => null,
    parseEnvFileFn: () => ({}),
    accessSyncFn: () => {},
    processObj: { version: 'v22.1.0' },
    importNgrok: async () => ({}),
    exitProcess: (code) => calls.push(`exit:${code}`),
    log: {
      info: (msg) => calls.push(`info:${msg}`),
      success: (msg) => calls.push(`success:${msg}`),
      warn: (msg) => calls.push(`warn:${msg}`),
      error: (msg) => calls.push(`error:${msg}`),
      dim: (msg) => calls.push(`dim:${msg}`),
    },
    ...overrides,
  }
}

test('collectDoctorChecks reports warnings when service is not configured', async () => {
  const checks = await collectDoctorChecks({ includeConfig: true }, createDeps())
  const summary = summarizeDoctorChecks(checks)

  assert.equal(summary.failures.length, 0)
  assert.equal(summary.warnings.length, 1)
  assert.match(summary.warnings[0].detail, /not configured/)
})

test('doctor exits with 1 when required dependency is missing', async () => {
  const deps = createDeps({
    execSync: (cmd) => {
      if (cmd === 'which systemctl') {
        throw new Error('missing')
      }
      if (cmd.startsWith('which ')) {
        return `/usr/bin/${cmd.slice(6)}\n`
      }
      return ''
    },
  })

  await doctor('doctor', [], deps)

  assert.ok(deps.calls.includes('exit:1'))
  assert.ok(deps.calls.some((entry) => entry.includes('systemctl not found')))
})

test('doctor validates configured tunnel mode requirements', async () => {
  const checks = await collectDoctorChecks({ includeConfig: true }, createDeps({
    loadConfig: () => ({ mode: 'ngrok', opencodePath: '/usr/bin/opencode' }),
    parseEnvFileFn: () => ({ OPENCODE_SERVER_USERNAME: 'admin', OPENCODE_SERVER_PASSWORD: 'StrongPass1!' }),
    importNgrok: async () => { throw new Error('missing') },
  }))

  const summary = summarizeDoctorChecks(checks)
  assert.ok(summary.failures.some((check) => check.label === 'NGROK_AUTHTOKEN'))
  assert.ok(summary.failures.some((check) => check.label === 'ngrok runtime'))
})
