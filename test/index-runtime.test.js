import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { COMMANDS, main, printHelp, readPackageVersion } from '../src/index.js'

test('printHelp renders CLI usage and command groups', () => {
  const output = []
  printHelp((text) => output.push(text))

  assert.match(output[0], /Usage:.*ocweb/)
  assert.match(output[0], /OpenCode Web Service Manager/)
  assert.match(output[0], /upgrade --schedule/)
})

test('main handles help, version, unknown command, and command errors', async () => {
  const exitCodes = []
  const outputs = []
  const errors = []
  const helpOutputs = []

  await main(['node', 'src/index.js'], {
    exitProcess: (code) => exitCodes.push(code),
    printHelpFn: (output) => output('help text'),
    output: (text) => helpOutputs.push(text),
  })

  await main(['node', 'src/index.js', '--version'], {
    exitProcess: (code) => exitCodes.push(code),
    readVersion: async () => '9.9.9',
    output: (text) => outputs.push(text),
  })

  await main(['node', 'src/index.js', 'badcommand'], {
    exitProcess: (code) => exitCodes.push(code),
    printHelpFn: (output) => output('unknown help'),
    output: (text) => outputs.push(text),
    logImpl: { error: (msg) => errors.push(msg) },
  })

  await main(['node', 'src/index.js', 'status'], {
    exitProcess: (code) => exitCodes.push(code),
    commandMap: {
      status: async () => ({
        default: async () => {
          throw new Error('boom')
        },
      }),
    },
    logImpl: { error: (msg) => errors.push(msg) },
  })

  assert.deepEqual(exitCodes, [0, 0, 1, 1])
  assert.ok(helpOutputs.includes('help text'))
  assert.ok(outputs.includes('9.9.9'))
  assert.ok(outputs.includes('unknown help'))
  assert.ok(errors.includes('Unknown command: badcommand'))
  assert.ok(errors.includes('boom'))
})

test('main surfaces real command error with actual command module', async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'ocweb-index-'))
  const errors = []
  const exitCodes = []
  const originalHome = process.env.HOME
  process.env.HOME = homeDir

  try {
    await main(['node', 'src/index.js', 'status'], {
      exitProcess: (code) => exitCodes.push(code),
      logImpl: { error: (msg) => errors.push(msg) },
    })
  } finally {
    process.env.HOME = originalHome
    rmSync(homeDir, { recursive: true, force: true })
  }

  assert.deepEqual(exitCodes, [1])
  assert.match(errors[0], /Service not configured\. Run "ocweb setup" first\./)
})

test('index exports all command loaders and can read package version', async () => {
  const version = await readPackageVersion()
  assert.equal(version, '0.1.0')

  for (const loader of Object.values(COMMANDS)) {
    const mod = await loader()
    assert.equal(typeof mod.default, 'function')
  }
})
