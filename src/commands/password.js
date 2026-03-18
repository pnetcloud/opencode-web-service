import { writeFileSync as _writeFileSync, chmodSync as _chmodSync } from 'node:fs'
import { join } from 'node:path'
import prompts from 'prompts'
import { log as _log } from '../utils/output.js'
import { ensureSetup as _ensureSetup, saveConfig as _saveConfig, getConfigDir } from '../utils/config.js'
import { validatePassword, hashPassword as _hashPassword } from '../utils/password.js'
import { buildEnvFileContent } from '../utils/env.js'
import { restartService as _restartService } from '../utils/systemd.js'

const ENV_FILE = join(getConfigDir(), 'env')

export default async function password(_command, _args, deps = {}) {
  const {
    ensureSetup = _ensureSetup,
    saveConfig = _saveConfig,
    hashPassword = _hashPassword,
    restartService = _restartService,
    prompt = prompts,
    writeFileSync = _writeFileSync,
    chmodSync = _chmodSync,
    log = _log,
  } = deps

  const config = ensureSetup()

  const response = await prompt({
    type: 'password',
    name: 'password',
    message: 'New password (min 8 chars, digit + special char)',
    validate: (v) => {
      const { valid, errors } = validatePassword(v)
      return valid || errors.join(', ')
    },
  })

  if (!response.password) {
    log.dim('Cancelled.')
    return
  }

  const hashedPassword = hashPassword(response.password)

  // Update env file
  writeFileSync(
    ENV_FILE,
    buildEnvFileContent({
      username: config.username || 'opencode',
      password: response.password,
      passwordHash: hashedPassword,
    }),
    'utf8'
  )
  chmodSync(ENV_FILE, 0o600)

  // Update config with new hash
  saveConfig({ ...config, passwordHash: hashedPassword })

  // Restart service
  restartService()
  log.success('Password updated, service restarted')
}
