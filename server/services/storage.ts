// Stockage de fichiers : S3-compatible (URLs signées) ou disque local en développement.
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'
import { env } from '../utils/env'
import { hmac, safeEqual } from '../utils/crypto'

const useS3 = () => !!env.s3().bucket
let client: S3Client | null = null
function s3() {
  if (client) return client
  const c = env.s3()
  client = new S3Client({ region: c.region, endpoint: c.endpoint || undefined, forcePathStyle: !!c.endpoint, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } })
  return client
}
const LOCAL_ROOT = join(process.cwd(), '.data', 'uploads')
const localPath = (key: string) => { const p = normalize(join(LOCAL_ROOT, key)); if (!p.startsWith(LOCAL_ROOT)) throw new Error('Clé invalide'); return p }

export async function putObject(key: string, body: Buffer, mime: string) {
  if (useS3()) { await s3().send(new PutObjectCommand({ Bucket: env.s3().bucket, Key: key, Body: body, ContentType: mime })); return }
  const p = localPath(key); await mkdir(dirname(p), { recursive: true }); await writeFile(p, body)
}
export async function getObject(key: string): Promise<Buffer> {
  if (useS3()) { const r = await s3().send(new GetObjectCommand({ Bucket: env.s3().bucket, Key: key })); return Buffer.from(await r.Body!.transformToByteArray()) }
  return readFile(localPath(key))
}
/** URL temporaire : presign S3, ou route locale signée HMAC (/api/files/…?exp=&sig=). */
export async function signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  if (useS3()) return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.s3().bucket, Key: key }), { expiresIn: ttlSeconds })
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return `/api/files/${encodeURIComponent(key)}?exp=${exp}&sig=${hmac(env.sessionSecret(), `${key}.${exp}`)}`
}
export function verifyLocalSignature(key: string, exp: number, sig: string): boolean {
  return exp > Date.now() / 1000 && safeEqual(hmac(env.sessionSecret(), `${key}.${exp}`), sig)
}
export const readLocal = (key: string) => readFile(localPath(key))

/** Dimensions + type réel par octets magiques (on ne se fie jamais au MIME ni à l'extension déclarés). */
export function sniffImage(buf: Buffer): { mime: 'image/png' | 'image/jpeg'; width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]!
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }
  return null
}
