import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getConfigDir } from './config.js'

export const ENV_FILE = join(getConfigDir(), 'env')

export function parseEnvFile(filePath, deps = {}) {
  const { readFileSyncFn = readFileSync } = deps
  try {
    const content = readFileSyncFn(filePath, 'utf8')
    return parseEnvContent(content)
  } catch {
    return {}
  }
}

export function parseEnvContent(content) {
  const vars = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key && value) vars[key] = value
    }
  }
  return vars
}

export function buildEnvFileContent({ username, password, ngrokAuthtoken }) {
  const lines = [
    `OPENCODE_SERVER_USERNAME=${username}`,
    `OPENCODE_SERVER_PASSWORD=${password}`,
  ]
  if (ngrokAuthtoken) {
    lines.push(`NGROK_AUTHTOKEN=${ngrokAuthtoken}`)
  }
  lines.push('')
  return lines.join('\n')
}
