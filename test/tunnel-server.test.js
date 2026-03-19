import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import boot from '../src/tunnel-server.js'

function mockProcessObj() {
  const proc = new EventEmitter()
  proc.env = { HOME: '/tmp' }
  proc.exit = (code) => { proc._exitCode = code }
  return proc
}

function mockChild() {
  const child = new EventEmitter()
  child.kill = (sig) => { child._killed = sig }
  return child
}

function mockNgrok() {
  const listener = {
    url: () => 'https://abc123.ngrok-free.app',
    close: async () => { listener._closed = true },
    _closed: false,
  }
  return {
    forward: async () => listener,
    _listener: listener,
  }
}

test('boot exits with 1 when no config', async () => {
  const proc = mockProcessObj()
  await boot({
    loadConfig: () => null,
    processObj: proc,
    log: { error: () => {}, log: () => {} },
  })

  assert.equal(proc._exitCode, 1)
})

test('boot exits with 1 when mode is not ngrok', async () => {
  const proc = mockProcessObj()
  await boot({
    loadConfig: () => ({ mode: 'local', port: 4096 }),
    processObj: proc,
    log: { error: () => {}, log: () => {} },
  })

  assert.equal(proc._exitCode, 1)
})

test('boot exits with 1 when @ngrok/ngrok not installed', async () => {
  const proc = mockProcessObj()
  await boot({
    loadConfig: () => ({ mode: 'ngrok', port: 4096 }),
    processObj: proc,
    log: { error: () => {}, log: () => {} },
    importNgrok: async () => { throw new Error('MODULE_NOT_FOUND') },
  })

  assert.equal(proc._exitCode, 1)
})

test('boot spawns opencode and returns child', async () => {
  const spawned = []
  const child = mockChild()
  const proc = mockProcessObj()
  const ngrok = mockNgrok()

  const result = await boot({
    loadConfig: () => ({
      mode: 'ngrok',
      port: 4096,
      opencodePath: '/usr/bin/opencode',
      workdir: '/home/user',
    }),
    spawn: (cmd, args, opts) => {
      spawned.push({ cmd, args, opts })
      return child
    },
    readFileSync: () => '',
    processObj: proc,
    log: { error: () => {}, log: () => {} },
    importNgrok: async () => ngrok,
    startupDelay: 0,
  })

  assert.ok(result.child)
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].cmd, '/usr/bin/opencode')
  assert.deepEqual(spawned[0].args, ['web', '--port', '4096', '--hostname', '127.0.0.1'])
  assert.equal(spawned[0].opts.cwd, '/home/user')
})

test('boot reads env file and passes vars to child', async () => {
  const child = mockChild()
  let spawnEnv
  const proc = mockProcessObj()

  await boot({
    loadConfig: () => ({
      mode: 'ngrok',
      port: 4096,
      opencodePath: 'opencode',
      envFile: '/tmp/env',
    }),
    spawn: (_cmd, _args, opts) => {
      spawnEnv = opts.env
      return child
    },
    readFileSync: () => 'OPENCODE_SERVER_USERNAME=admin\nOPENCODE_SERVER_PASSWORD=secret\nNGROK_AUTHTOKEN=tok123\n',
    processObj: proc,
    log: { error: () => {}, log: () => {} },
    importNgrok: async () => mockNgrok(),
    startupDelay: 0,
  })

  assert.equal(spawnEnv.OPENCODE_SERVER_USERNAME, 'admin')
  assert.equal(spawnEnv.OPENCODE_SERVER_PASSWORD, 'secret')
  assert.equal(spawnEnv.NGROK_AUTHTOKEN, 'tok123')
})

test('boot handles child error', async () => {
  const child = mockChild()
  const proc = mockProcessObj()

  await boot({
    loadConfig: () => ({
      mode: 'ngrok',
      port: 4096,
      opencodePath: 'opencode',
    }),
    spawn: () => child,
    readFileSync: () => '',
    processObj: proc,
    log: { error: () => {}, log: () => {} },
    importNgrok: async () => mockNgrok(),
    startupDelay: 99999,
  })

  child.emit('error', new Error('spawn failed'))

  assert.equal(proc._exitCode, 1)
})

test('boot graceful shutdown closes listener and kills child', async () => {
  const child = mockChild()
  const proc = mockProcessObj()
  const ngrok = mockNgrok()

  await boot({
    loadConfig: () => ({
      mode: 'ngrok',
      port: 4096,
      opencodePath: 'opencode',
    }),
    spawn: () => child,
    readFileSync: () => '',
    processObj: proc,
    log: { error: () => {}, log: () => {} },
    importNgrok: async () => ngrok,
    startupDelay: 0,
  })

  // Wait for setTimeout(0) to fire
  await new Promise(r => setTimeout(r, 50))

  proc.emit('SIGTERM')

  assert.equal(child._killed, 'SIGTERM')
  assert.equal(ngrok._listener._closed, true)
})
