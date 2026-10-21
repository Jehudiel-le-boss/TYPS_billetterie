import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareImageUpload } from '../shared/image-upload'

afterEach(() => vi.unstubAllGlobals())

describe('préparation des images envoyées par formulaire', () => {
  it('garde une image déjà sous la limite et dans les dimensions acceptées', async () => {
    const file = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1200, height: 800, close }))

    await expect(prepareImageUpload(file)).resolves.toBe(file)
    expect(close).toHaveBeenCalledOnce()
  })

  it('réduit une image trop lourde sans supprimer sa transparence PNG', async () => {
    const file = new Blob([new Uint8Array(4 * 1024 * 1024)], { type: 'image/png' })
    const close = vi.fn()
    const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/png' })))
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 5000, height: 5000, close }))
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })

    const result = await prepareImageUpload(file)

    expect(result.size).toBeLessThan(3.5 * 1024 * 1024)
    expect(result.type).toBe('image/png')
    expect(canvas.width).toBeLessThanOrEqual(6000)
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(24_000_000)
    expect(close).toHaveBeenCalledOnce()
  })

  it('refuse les formats inconnus et les images de plus de 5 Mo avant décodage', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    await expect(prepareImageUpload(new Blob(['x'], { type: 'image/gif' }))).rejects.toThrow('PNG ou JPEG')
    await expect(prepareImageUpload(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }))).rejects.toThrow('5 Mo maximum')
    expect(decode).not.toHaveBeenCalled()
  })
})
