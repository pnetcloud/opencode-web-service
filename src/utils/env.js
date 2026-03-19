export function buildEnvFileContent({ username, password }) {
  return [
    `OPENCODE_SERVER_USERNAME=${username}`,
    `OPENCODE_SERVER_PASSWORD=${password}`,
    '',
  ].join('\n')
}
