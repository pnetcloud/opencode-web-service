import { ensureSetup as _ensureSetup } from '../utils/config.js'
import { getLogs as _getLogs, UNIT_NAME } from '../utils/systemd.js'
import { spawn as _spawn } from 'node:child_process'
import { log as _log } from '../utils/output.js'

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
    log = _log,
  } = deps

  ensureSetup()
  const opts = parseLogsArgs(args)

  if (opts.follow) {
    const cmdArgs = ['--user', '-u', UNIT_NAME, '-n', String(opts.lines), '--no-pager', '-f']
    if (opts.since) {
      const safe = String(opts.since).replace(/[^a-zA-Z0-9 :._\-]/g, '')
      if (!safe.trim()) {
        log.error('Invalid value for --since')
        return
      }
      cmdArgs.push('--since', safe)
    }
    try {
      const child = spawn('journalctl', cmdArgs, { stdio: 'inherit' })
      await new Promise((resolve) => {
        child.on('error', (error) => {
          log.error(`Failed to follow logs: ${error.message}`)
          resolve()
        })
        child.on('close', (code) => {
          if (code && code !== 0) {
            log.warn('journalctl exited before logs could be followed. Check that user systemd logs are available.')
          }
          resolve()
        })
      })
    } catch (error) {
      log.error(`Failed to follow logs: ${error.message}`)
    }
    return
  }

  try {
    if (opts.since) {
      const safe = String(opts.since).replace(/[^a-zA-Z0-9 :._\-]/g, '')
      if (!safe.trim()) {
        log.error('Invalid value for --since')
        return
      }
    }
    const output = getLogs(opts.lines, opts.since)
    if (!String(output || '').trim()) {
      log.info('No recent logs found. Try `ocweb logs -f` while the service is starting.')
      return
    }
    console.log(output)
  } catch (error) {
    log.error(`Failed to read logs: ${error.message}`)
    log.dim('Check that the service is configured and journald is available.')
  }
}
