// Stockage de fichiers : Cloudinary privé, S3-compatible ou disque local en développement.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'
import { Readable } from 'node:stream'
import { v2 as cloudinary } from 'cloudinary'
import { env } from '../utils/env'
import { hmac, safeEqual } from '../utils/crypto'

type StorageProvider = 'cloudinary' | 's3' | 'local'
function storageProvider(): StorageProvider {
  const cloud = env.cloudinary()
  const hasCloud = !!(cloud.cloudName || cloud.apiKey || cloud.apiSecret)
  const cloudConfigured = !!(cloud.cloudName && cloud.apiKey && cloud.apiSecret)
  if (hasCloud && !cloudConfigured) throw new Error('Configuration Cloudinary incomplète : cloud name, API key et API secret sont requis')
  if (cloudConfigured) return 'cloudinary'

  const s = env.s3()
  const hasS3 = !!(s.endpoint || s.bucket || s.accessKeyId || s.secretAccessKey)
  const s3Configured = !!(s.bucket && s.accessKeyId && s.secretAccessKey)
  if (hasS3 && !s3Configured) throw new Error('Configuration S3 incomplète : bucket et identifiants sont requis')
  if (s3Configured) return 's3'
  if (env.isProd()) throw new Error('Un stockage Cloudinary ou S3 est requis en production')
  return 'local'
}
let client: S3Client | null = null
function s3() {
  if (client) return client
  const c = env.s3()
  client = new S3Client({ region: c.region, endpoint: c.endpoint || undefined, forcePathStyle: !!c.endpoint, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } })
  return client
}
let cloudinaryConfigured = false
function cloudinaryClient() {
  if (!cloudinaryConfigured) {
    const c = env.cloudinary()
    cloudinary.config({ cloud_name: c.cloudName, api_key: c.apiKey, api_secret: c.apiSecret, secure: true })
    cloudinaryConfigured = true
  }
  return cloudinary
}
const LOCAL_ROOT = join(process.cwd(), '.data', 'uploads')
const localPath = (key: string) => { const p = normalize(join(LOCAL_ROOT, key)); if (!p.startsWith(LOCAL_ROOT)) throw new Error('Clé invalide'); return p }

export async function putObject(key: string, body: Buffer, mime: string): Promise<string> {
  const provider = storageProvider()
  if (provider === 'cloudinary') {
    const publicId = key.replace(/\.(?:png|jpe?g)$/i, '')
    const cloud = cloudinaryClient()
    await new Promise<void>((resolve, reject) => {
      const upload = cloud.uploader.upload_stream({
        public_id: publicId,
        resource_type: 'image',
        type: 'private',
        overwrite: false,
        unique_filename: false,
        use_filename: false
      }, (error, result) => {
        if (error) reject(error)
        else if (result?.public_id) resolve()
        else reject(new Error('Cloudinary n’a pas confirmé le téléversement'))
      })
      upload.on('error', reject)
      Readable.from([body]).pipe(upload)
    })
    return `cld:${key}`
  }
  if (provider === 's3') { await s3().send(new PutObjectCommand({ Bucket: env.s3().bucket, Key: key, Body: body, ContentType: mime })); return key }
  const p = localPath(key); await mkdir(dirname(p), { recursive: true }); await writeFile(p, body)
  return key
}
export async function getObject(key: string): Promise<Buffer> {
  if (key.startsWith('cld:')) {
    const url = cloudinaryPrivateDownloadUrl(key, 60)
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`Échec de récupération Cloudinary (HTTP ${response.status})`)
    return Buffer.from(await response.arrayBuffer())
  }
  if (storageProvider() === 's3') { const r = await s3().send(new GetObjectCommand({ Bucket: env.s3().bucket, Key: key })); if (!r.Body) throw new Error('Objet S3 vide'); return Buffer.from(await r.Body.transformToByteArray()) }
  return readFile(localPath(key))
}
export async function deleteObject(key: string) {
  if (key.startsWith('cld:')) {
    const cloudKey = key.slice(4)
    const publicId = cloudKey.replace(/\.(?:png|jpe?g)$/i, '')
    const result = await cloudinaryClient().uploader.destroy(publicId, { resource_type: 'image', type: 'private', invalidate: true })
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error(`Échec de suppression Cloudinary (${result.result})`)
    return
  }
  if (storageProvider() === 's3') {
    await s3().send(new DeleteObjectCommand({ Bucket: env.s3().bucket, Key: key }))
    return
  }
  await rm(localPath(key), { force: true })
}
/** URL temporaire : URL privée signée du fournisseur, ou route HMAC en stockage local. */
export async function signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  if (key.startsWith('cld:')) return cloudinaryPrivateDownloadUrl(key, ttlSeconds)
  if (!key.startsWith('cld:') && storageProvider() === 's3') return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.s3().bucket, Key: key }), { expiresIn: ttlSeconds })
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return `/api/files/${encodeURIComponent(key)}?exp=${exp}&sig=${hmac(env.sessionSecret(), `${key}.${exp}`)}`
}
function cloudinaryPrivateDownloadUrl(key: string, ttlSeconds: number): string {
  const cloudKey = key.slice(4)
  const format = cloudKey.split('.').pop()
  if (!format || !/^(png|jpe?g)$/i.test(format)) throw new Error('Format Cloudinary invalide')
  const publicId = cloudKey.replace(/\.(?:png|jpe?g)$/i, '')
  return cloudinaryClient().utils.private_download_url(publicId, format, {
    resource_type: 'image',
    type: 'private',
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds
  })
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
