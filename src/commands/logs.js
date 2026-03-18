import { ensureSetup as _ensureSetup } from '../utils/config.js'
import { getLogs as _getLogs } from '../utils/systemd.js'

export default async function logs(_command, _args, deps = {}) {
  const { ensureSetup = _ensureSetup, getLogs = _getLogs } = deps

  ensureSetup()
  const output = getLogs(100)
  console.log(output)
}
