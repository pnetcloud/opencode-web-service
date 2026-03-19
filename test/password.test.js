import test from 'node:test'
import assert from 'node:assert/strict'

import { hashPassword, validatePassword } from '../src/utils/password.js'

test('validatePassword reports each failed complexity rule', () => {
  assert.deepEqual(validatePassword('short').errors, [
    'Minimum 8 characters',
    'At least 1 digit',
    'At least 1 special character (!@#$%^&* etc.)',
  ])
})

test('validatePassword accepts strong passwords', () => {
  assert.equal(validatePassword('StrongPass1!').valid, true)
})

test('hashPassword returns scrypt salt:hash format', () => {
  const hash = hashPassword('StrongPass1!')
  const parts = hash.split(':')

  assert.equal(parts.length, 2, 'should be salt:hash')
  assert.equal(parts[0].length, 64, 'salt should be 32 bytes hex')
  assert.equal(parts[1].length, 128, 'hash should be 64 bytes hex')
})
