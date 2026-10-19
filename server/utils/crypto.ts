import { randomBytes, createHash, createHmac, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('base64url')
export const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const key = await scrypt(password, Buffer.from(salt, 'base64'), 64, { N: Number(N), r: Number(r), p: Number(p) })
  const expected = Buffer.from(hash, 'base64')
  return key.length === expected.length && timingSafeEqual(key, expected)
}
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function randomCode(len: number): string {
  const bytes = randomBytes(len); let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length]
  return out
}
export const ticketRef = () => `TY-${randomCode(8)}`
