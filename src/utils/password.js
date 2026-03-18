import { randomBytes, scryptSync } from 'node:crypto'

const SALT_LENGTH = 32
const KEY_LENGTH = 64
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1

/**
 * Validate password complexity.
 * Requirements: >= 8 chars, at least 1 digit, at least 1 special char.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePassword(password) {
  const errors = []

  if (password.length < 8) {
    errors.push('Minimum 8 characters')
  }
  if (!/\d/.test(password)) {
    errors.push('At least 1 digit')
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('At least 1 special character (!@#$%^&* etc.)')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Hash password using Node.js built-in scrypt.
 * Returns a string: salt:hash (hex encoded).
 */
export function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
  }).toString('hex')
  return `${salt}:${hash}`
}
