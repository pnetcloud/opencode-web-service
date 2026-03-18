import { execSync as _execSync } from 'node:child_process'
import { readFileSync as _readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import prompts from 'prompts'
import { log as _log } from '../utils/output.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_PATH = join(__dirname, '..', '..', 'package.json')

export function readPkg(deps = {}) {
  const { readFileSync = _readFileSync } = deps
  return JSON.parse(readFileSync(PKG_PATH, 'utf8'))
}

export function checkNpmAuth(deps = {}) {
  const { execSync = _execSync } = deps
  try {
    const whoami = execSync('npm whoami', { encoding: 'utf8', stdio: 'pipe' }).trim()
    return whoami || null
  } catch {
    return null
  }
}

export function runTests(deps = {}) {
  const { execSync = _execSync } = deps
  try {
    execSync('npm test', { encoding: 'utf8', stdio: 'pipe', cwd: join(__dirname, '..', '..') })
    return { ok: true, output: '' }
  } catch (err) {
    return { ok: false, output: err.stdout || err.stderr || err.message }
  }
}

export function dryRun(deps = {}) {
  const { execSync = _execSync } = deps
  return execSync('npm pack --dry-run 2>&1', {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd: join(__dirname, '..', '..'),
  })
}

export function npmPublish(tag, deps = {}) {
  const { execSync = _execSync } = deps
  const cmd = tag ? `npm publish --tag ${tag}` : 'npm publish'
  execSync(cmd, { encoding: 'utf8', stdio: 'inherit', cwd: join(__dirname, '..', '..') })
}

export function bumpVersion(type, deps = {}) {
  const { execSync = _execSync } = deps
  const result = execSync(`npm version ${type} --no-git-tag-version`, {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd: join(__dirname, '..', '..'),
  })
  return result.trim()
}

export default async function publish(_command, _args, deps = {}) {
  const {
    log = _log,
    prompt = prompts,
    exitProcess = (code) => process.exit(code),
    _checkNpmAuth = checkNpmAuth,
    _runTests = runTests,
    _dryRun = dryRun,
    _npmPublish = npmPublish,
    _bumpVersion = bumpVersion,
    _readPkg = readPkg,
  } = deps

  const pkg = _readPkg(deps)
  log.info(`Package: ${pkg.name}@${pkg.version}\n`)

  // Step 1: Check npm auth
  log.step('Checking npm authentication...')
  const whoami = _checkNpmAuth(deps)
  if (!whoami) {
    log.error('Not logged in to npm. Run "npm login" first.')
    exitProcess(1)
    return
  }
  log.success(`Authenticated as: ${whoami}`)

  // Step 2: Run tests
  log.step('Running tests...')
  const testResult = _runTests(deps)
  if (!testResult.ok) {
    log.error('Tests failed! Fix issues before publishing.')
    if (testResult.output) log.dim(testResult.output.slice(0, 500))
    exitProcess(1)
    return
  }
  log.success('All tests passed')

  // Step 3: Dry run
  log.step('Package contents (dry run):')
  const packOutput = _dryRun(deps)
  console.log(packOutput)

  // Step 4: Version bump
  const { bump } = await prompt({
    type: 'select',
    name: 'bump',
    message: 'Version bump?',
    choices: [
      { title: `Keep current (${pkg.version})`, value: 'none' },
      { title: 'Patch (bug fix)', value: 'patch' },
      { title: 'Minor (new feature)', value: 'minor' },
      { title: 'Major (breaking change)', value: 'major' },
    ],
    initial: 0,
  })

  if (bump === undefined) {
    log.dim('Cancelled.')
    return
  }

  let version = pkg.version
  if (bump !== 'none') {
    version = _bumpVersion(bump, deps)
    log.success(`Version bumped to ${version}`)
  }

  // Step 5: Tag selection
  const { tag } = await prompt({
    type: 'select',
    name: 'tag',
    message: 'Publish tag?',
    choices: [
      { title: 'latest (default)', value: '' },
      { title: 'beta', value: 'beta' },
      { title: 'next', value: 'next' },
    ],
    initial: 0,
  })

  if (tag === undefined) {
    log.dim('Cancelled.')
    return
  }

  // Step 6: Confirmation
  const { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: `Publish ${pkg.name}@${version}${tag ? ` (tag: ${tag})` : ''} to npm?`,
    initial: false,
  })

  if (!confirm) {
    log.dim('Cancelled.')
    return
  }

  // Step 7: Publish
  log.step('Publishing to npm...')
  try {
    _npmPublish(tag, deps)
    log.success(`Published ${pkg.name}@${version} 🚀`)
    log.info(`Install: npm install -g ${pkg.name}`)
  } catch (err) {
    log.error(`Publish failed: ${err.message}`)
    exitProcess(1)
  }
}
