import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const README_FILES = [
  'README.md',
  'README.ru.md',
  'README.zh.md',
  'README.ja.md',
  'README.ko.md',
  'README.es.md',
  'README.de.md',
  'README.fr.md',
  'README.uk.md',
]

function readDoc(file) {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
}

function getSwitcher(text) {
  const match = text.match(/<p align="center">\n  <a href="README\.md">English<\/a>[\s\S]*?<\/p>/)
  assert.ok(match, 'language switcher is present')
  return match[0]
}

test('all README translations include the same language switcher', () => {
  const switcher = getSwitcher(readDoc('README.md'))

  for (const file of README_FILES.slice(1)) {
    assert.equal(getSwitcher(readDoc(file)), switcher, `${file} should keep the same switcher`)
  }
})

test('english README covers story 3.1 content requirements', () => {
  const readme = readDoc('README.md')

  for (const snippet of [
    'npx opencode-web-service setup',
    '## Commands',
    '## Command Examples',
    '## Security',
    '## Remote Access',
    '## Auto-Upgrades',
    '## Requirements',
    '## Troubleshooting',
    '## Disclaimer',
    '## License',
    'not affiliated',
    '0.0.0.0',
    'Tailscale',
    'ngrok',
  ]) {
    assert.match(readme, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const command of [
    'ocweb setup',
    'ocweb start',
    'ocweb stop',
    'ocweb restart',
    'ocweb status',
    'ocweb logs',
    'ocweb password',
    'ocweb config',
    'ocweb config set <key> <value>',
    'ocweb upgrade',
    'ocweb upgrade --schedule "<cron>"',
    'ocweb uninstall',
    'ocweb config set port 5000',
    'ocweb upgrade --schedule "0 3 * * *"',
  ]) {
    assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
