/**
 * LearnMate AI — Cryptographic Password Hashing (Node.js crypto.scrypt)
 * Uses 16-byte random salt and timingSafeEqual to prevent timing attacks.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 64;

export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, KEY_BYTES).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, keyHex] = parts;
  if (!salt || !keyHex) {
    return false;
  }
  const expectedBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = scryptSync(plainPassword, salt, expectedBuffer.length);
  if (expectedBuffer.length !== derivedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, derivedBuffer);
}
