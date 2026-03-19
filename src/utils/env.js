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
