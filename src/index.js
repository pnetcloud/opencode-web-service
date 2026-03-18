#!/usr/bin/env node

import pc from 'picocolors'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { log } from './utils/output.js'

export const COMMANDS = {
  setup:    () => import('./commands/setup.js'),
  start:    () => import('./commands/service.js'),
  stop:     () => import('./commands/service.js'),
  restart:  () => import('./commands/service.js'),
  status:   () => import('./commands/status.js'),
  logs:     () => import('./commands/logs.js'),
  password: () => import('./commands/password.js'),
  config:   () => import('./commands/config.js'),
  upgrade:  () => import('./commands/upgrade.js'),
  uninstall:() => import('./commands/uninstall.js'),
  publish:  () => import('./commands/publish.js'),
}

export async function readPackageVersion() {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
  return pkg.version
}

export async function main(argv = process.argv, deps = {}) {
  const {
    commandMap = COMMANDS,
    logImpl = log,
    exitProcess = (code) => process.exit(code),
    printHelpFn = printHelp,
    readVersion = readPackageVersion,
    output = console.log,
  } = deps
  const [,, command, ...args] = argv

  if (!command || command === '--help' || command === '-h') {
    printHelpFn(output)
    exitProcess(0)
    return
  }

  if (command === '--version' || command === '-v') {
    output(await readVersion())
    exitProcess(0)
    return
  }

  const loader = commandMap[command]
  if (!loader) {
    logImpl.error(`Unknown command: ${command}`)
    printHelpFn(output)
    exitProcess(1)
    return
  }

  try {
    const mod = await loader()
    await mod.default(command, args)
  } catch (err) {
    logImpl.error(err.message)
    exitProcess(1)
  }
}

export function printHelp(output = console.log) {

  // ASCII art banner
  const banner = [
    '',
    pc.cyan('   ╔═╗╔═╗╦ ╦╔═╗╔╗ '),
    pc.cyan('   ║ ║║  ║║║║╣ ╠╩╗') + pc.dim('  ─  OpenCode Web Service Manager'),
    pc.cyan('   ╚═╝╚═╝╚╩╝╚═╝╚═╝'),
    '',
    pc.dim('   ─────────────────────────────────────────────'),
  ]

  const usage = `  ${pc.dim('Usage:')} ${pc.bold('ocweb')} ${pc.magenta('<command>')} ${pc.dim('[options]')}`

  const sections = [
    '',
    ...banner,
    '',
    usage,
    '',
    `  ${pc.bold(pc.cyan('⚡ Setup'))}`,
    `    ${pc.bold('setup')}                      ${pc.dim('Interactive setup wizard')}`,
    '',
    `  ${pc.bold(pc.green('▶ Service'))}`,
    `    ${pc.bold('start')}                      ${pc.dim('Start the service')}`,
    `    ${pc.bold('stop')}                       ${pc.dim('Stop the service')}`,
    `    ${pc.bold('restart')}                    ${pc.dim('Restart the service')}`,
    `    ${pc.bold('status')}                     ${pc.dim('Show service status')}`,
    `    ${pc.bold('logs')}                       ${pc.dim('Show service logs')}`,
    '',
    `  ${pc.bold(pc.yellow('⚙ Configure'))}`,
    `    ${pc.bold('password')}                   ${pc.dim('Change password')}`,
    `    ${pc.bold('config')}                     ${pc.dim('Show current config')}`,
    `    ${pc.bold('config set')} ${pc.magenta('<key> <value>')}   ${pc.dim('Update a setting')}`,
    '',
    `  ${pc.bold(pc.blue('↑ Upgrade'))}`,
    `    ${pc.bold('upgrade')}                    ${pc.dim('Upgrade OpenCode & restart')}`,
    `    ${pc.bold('upgrade --schedule')} ${pc.magenta('<cron>')}  ${pc.dim('Set up auto-upgrade')}`,
    '',
    `  ${pc.bold(pc.magenta('📦 Publish'))}`,
    `    ${pc.bold('publish')}                    ${pc.dim('Publish package to npm')}`,
    '',
    `  ${pc.bold(pc.red('✕ Remove'))}`,
    `    ${pc.bold('uninstall')}                  ${pc.dim('Remove service & config')}`,
    '',
    `  ${pc.dim('Options:')}`,
    `    ${pc.dim('-h, --help')}                 ${pc.dim('Show this help')}`,
    `    ${pc.dim('-v, --version')}              ${pc.dim('Show version')}`,
    '',
  ]

  output(sections.join('\n'))
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isDirectExecution()) {
  main()
}
