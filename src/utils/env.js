export function buildEnvFileContent({ username, password, passwordHash }) {
  return [
    `OPENCODE_SERVER_USERNAME=${username}`,
    `OPENCODE_SERVER_PASSWORD=${password}`,
    `OCWEB_PASSWORD_HASH=${passwordHash}`,
    '',
  ].join('\n')
}
