import { ensureSetup as _ensureSetup } from '../utils/config.js'
import { getLogs as _getLogs } from '../utils/systemd.js'
import { spawn as _spawn } from 'node:child_process'

const UNIT_NAME = 'ocweb.service'

export function parseLogsArgs(args) {
  const opts = { lines: 100, follow: false, since: null }

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--lines' || args[i] === '-n') && args[i + 1]) {
      const n = Number(args[i + 1])
      if (Number.isInteger(n) && n > 0) opts.lines = n
      i++
    } else if (args[i] === '--follow' || args[i] === '-f') {
      opts.follow = true
    } else if (args[i] === '--since' && args[i + 1]) {
      opts.since = args[i + 1]
      i++
    }
  }

  return opts
}

export default async function logs(_command, args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    getLogs = _getLogs,
    spawn = _spawn,
  } = deps

  ensureSetup()
  const opts = parseLogsArgs(args)

  if (opts.follow) {
    const cmdArgs = ['--user', '-u', UNIT_NAME, '-n', String(opts.lines), '--no-pager', '-f']
    if (opts.since) cmdArgs.push('--since', opts.since)
    const child = spawn('journalctl', cmdArgs, { stdio: 'inherit' })
    await new Promise((resolve) => child.on('close', resolve))
    return
  }

  const output = getLogs(opts.lines, opts.since)
  console.log(output)
}
