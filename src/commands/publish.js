import { execSync as _execSync, execFileSync as _execFileSync } from 'node:child_process'
import { readFileSync as _readFileSync, existsSync as _existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import prompts from 'prompts'
import { log as _log } from '../utils/output.js'
import { parseEnvContent } from '../utils/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = join(__dirname, '..', '..')
const PKG_PATH = join(PKG_ROOT, 'package.json')

export function loadEnvFile(deps = {}) {
  const { readFileSync = _readFileSync, existsSync = _existsSync } = deps
  const envPath = join(PKG_ROOT, '.env')
  if (!existsSync(envPath)) return {}
  return parseEnvContent(readFileSync(envPath, 'utf8'))
}

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

export function setNpmToken(token, deps = {}) {
  const { execSync = _execSync } = deps
  execSync(`npm config set //registry.npmjs.org/:_authToken=${token}`, {
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

export function runTests(deps = {}) {
  const { execSync = _execSync } = deps
  try {
    execSync('npm test', { encoding: 'utf8', stdio: 'pipe', cwd: PKG_ROOT })
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
    cwd: PKG_ROOT,
  })
}

export function npmPublish(tag, deps = {}) {
  const { execSync = _execSync } = deps
  const cmd = tag ? `npm publish --tag ${tag}` : 'npm publish'
  execSync(cmd, { encoding: 'utf8', stdio: 'inherit', cwd: PKG_ROOT })
}

export function bumpVersion(type, deps = {}) {
  const { execSync = _execSync } = deps
  const result = execSync(`npm version ${type} --no-git-tag-version`, {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd: PKG_ROOT,
  })
  return result.trim()
}

export function gitTagAndCommit(version, deps = {}) {
  const { execSync = _execSync } = deps
  const tag = version.startsWith('v') ? version : `v${version}`
  execSync('git add package.json package-lock.json', { cwd: PKG_ROOT, stdio: 'pipe' })
  execSync(`git commit -m "release: ${tag}"`, { cwd: PKG_ROOT, stdio: 'pipe' })
  execSync(`git tag ${tag}`, { cwd: PKG_ROOT, stdio: 'pipe' })
  return tag
}

export function gitRollbackBump(deps = {}) {
  const { execSync = _execSync } = deps
  try {
    execSync('git checkout package.json package-lock.json', { cwd: PKG_ROOT, stdio: 'pipe' })
  } catch { /* nothing to rollback */ }
}

export function gitPush(tag, deps = {}) {
  const { execSync = _execSync } = deps
  execSync('git push', { cwd: PKG_ROOT, stdio: 'inherit' })
  execSync(`git push origin ${tag}`, { cwd: PKG_ROOT, stdio: 'inherit' })
}

export function extractChangelogSection(version, deps = {}) {
  const { readFileSync = _readFileSync, existsSync = _existsSync } = deps
  const changelogPath = join(PKG_ROOT, 'CHANGELOG.md')
  if (!existsSync(changelogPath)) return null

  const content = readFileSync(changelogPath, 'utf8')
  const bare = version.replace(/^v/, '')
  const startRe = new RegExp(`^## \\[${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'm')
  const startMatch = startRe.exec(content)
  if (!startMatch) return null

  const afterHeader = content.slice(startMatch.index + startMatch[0].length)
  const nextSection = afterHeader.search(/^## \[/m)
  const body = nextSection === -1
    ? afterHeader
    : afterHeader.slice(0, nextSection)

  const trimmed = body.replace(/^[^\S\n]*\n/, '').trimEnd()
  return trimmed || null
}

export function createGitHubRelease(tag, notes, deps = {}) {
  const { execFileSync = _execFileSync } = deps
  try {
    const args = ['release', 'create', tag, '--title', tag]
    if (notes) {
      args.push('--notes', notes)
    } else {
      args.push('--generate-notes')
    }
    execFileSync('gh', args, { cwd: PKG_ROOT, stdio: 'pipe', encoding: 'utf8' })
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

export default async function publish(_command, _args, deps = {}) {
  const {
    log = _log,
    prompt = prompts,
    exitProcess = (code) => process.exit(code),
    _checkNpmAuth = checkNpmAuth,
    _setNpmToken = setNpmToken,
    _loadEnvFile = loadEnvFile,
    _runTests = runTests,
    _dryRun = dryRun,
    _npmPublish = npmPublish,
    _bumpVersion = bumpVersion,
    _gitTagAndCommit = gitTagAndCommit,
    _gitRollbackBump = gitRollbackBump,
    _gitPush = gitPush,
    _readPkg = readPkg,
    _extractChangelogSection = extractChangelogSection,
    _createGitHubRelease = createGitHubRelease,
  } = deps

  const pkg = _readPkg(deps)
  log.info(`Package: ${pkg.name}@${pkg.version}\n`)

  // Step 1: Load .env token if present
  const env = _loadEnvFile(deps)
  if (env.NPM_TOKEN) {
    log.step('Found NPM_TOKEN in .env, configuring...')
    _setNpmToken(env.NPM_TOKEN, deps)
  }

  // Step 2: Check npm auth
  log.step('Checking npm authentication...')
  const whoami = _checkNpmAuth(deps)
  if (!whoami) {
    log.error('Not logged in to npm.')
    if (!env.NPM_TOKEN) {
      log.dim('Options:')
      log.dim('  1. Run "npm login"')
      log.dim('  2. Add NPM_TOKEN to .env (see .env.example)')
      log.dim('  3. Use CI with Trusted Publishers (recommended)')
    } else {
      log.dim('NPM_TOKEN in .env is invalid or expired. Generate a new one at npmjs.com.')
    }
    exitProcess(1)
    return
  }
  log.success(`Authenticated as: ${whoami}`)

  // Step 3: Run tests
  log.step('Running tests...')
  const testResult = _runTests(deps)
  if (!testResult.ok) {
    log.error('Tests failed! Fix issues before publishing.')
    if (testResult.output) log.dim(testResult.output.slice(0, 500))
    exitProcess(1)
    return
  }
  log.success('All tests passed')

  // Step 4: Dry run
  log.step('Package contents (dry run):')
  const packOutput = _dryRun(deps)
  console.log(packOutput)

  // Step 5: Version bump
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

  // Step 6: Publish method
  const { method } = await prompt({
    type: 'select',
    name: 'method',
    message: 'How to publish?',
    choices: [
      { title: '🚀 CI (git tag → GitHub Release → Trusted Publishers)', value: 'ci' },
      { title: '📦 Local (npm publish directly)', value: 'local' },
    ],
    initial: 0,
  })

  if (method === undefined) {
    if (bump !== 'none') _gitRollbackBump(deps)
    log.dim('Cancelled.')
    return
  }

  if (method === 'ci') {
    // CI flow: commit, tag, push, suggest release
    if (bump === 'none') {
      log.warn('No version bump — nothing to tag. Bump the version first.')
      return
    }

    const tag = _gitTagAndCommit(version, deps)
    log.success(`Committed and tagged ${tag}`)

    const { push } = await prompt({
      type: 'confirm',
      name: 'push',
      message: `Push ${tag} to origin?`,
      initial: true,
    })

    if (push) {
      log.step('Pushing...')
      _gitPush(tag, deps)
      log.success('Pushed!')
      console.log('')

      log.step('Creating GitHub Release...')
      const notes = _extractChangelogSection(version, deps)
      const release = _createGitHubRelease(tag, notes, deps)
      if (release.ok) {
        log.success(`GitHub Release ${tag} created`)
        log.dim(`  https://github.com/pnetcloud/opencode-web-service/releases/tag/${tag}`)
      } else {
        log.warn(`Could not create GitHub Release: ${release.message}`)
        log.dim(`  Create manually: https://github.com/pnetcloud/opencode-web-service/releases/new?tag=${tag}`)
      }
      log.dim('  CI will run tests and publish with provenance automatically.')
    } else {
      log.info(`Run manually: git push && git push origin ${tag}`)
    }
    return
  }

  // Local flow: publish directly
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
    if (bump !== 'none') _gitRollbackBump(deps)
    log.dim('Cancelled.')
    return
  }

  const { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: `Publish ${pkg.name}@${version}${tag ? ` (tag: ${tag})` : ''} to npm?`,
    initial: false,
  })

  if (!confirm) {
    if (bump !== 'none') _gitRollbackBump(deps)
    log.dim('Cancelled.')
    return
  }

  log.step('Publishing to npm...')
  try {
    _npmPublish(tag, deps)
    log.success(`Published ${pkg.name}@${version} 🚀`)
    log.info(`Install: npm install -g ${pkg.name}`)

    // Tag in git after successful local publish
    if (bump !== 'none') {
      const gitTag = _gitTagAndCommit(version, deps)
      log.success(`Tagged ${gitTag} in git`)
      log.dim('Run: git push && git push --tags')
    }
  } catch (err) {
    log.error(`Publish failed: ${err.message}`)
    if (bump !== 'none') _gitRollbackBump(deps)
    exitProcess(1)
  }
}
