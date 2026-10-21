const MAX_REQUEST_IMAGE_BYTES = 3.5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 6000
const MAX_IMAGE_PIXELS = 24_000_000
const MAX_SOURCE_IMAGE_BYTES = 5 * 1024 * 1024

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Le navigateur n’a pas pu compresser cette image.')), type, quality)
  })
}

export async function prepareImageUpload(file: Blob): Promise<Blob> {
  if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Format refusé : sélectionne une image PNG ou JPEG.')
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('Image source trop volumineuse (5 Mo maximum avant compression).')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Image illisible. Choisis un fichier PNG ou JPG valide.')
  }

  try {
    const withinDimensions = bitmap.width <= MAX_IMAGE_DIMENSION && bitmap.height <= MAX_IMAGE_DIMENSION && bitmap.width * bitmap.height <= MAX_IMAGE_PIXELS
    if (file.size <= MAX_REQUEST_IMAGE_BYTES && withinDimensions) return file
    let scale = Math.min(1, MAX_IMAGE_DIMENSION / bitmap.width, MAX_IMAGE_DIMENSION / bitmap.height, Math.sqrt(MAX_IMAGE_PIXELS / (bitmap.width * bitmap.height)) * 0.995)
    const jpeg = file.type === 'image/jpeg'
    for (let attempt = 0; attempt < 10; attempt++) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('La compression d’image n’est pas disponible dans ce navigateur.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      const qualities = jpeg ? [0.86, 0.76, 0.66, 0.56] : [undefined]
      for (const quality of qualities) {
        const result = await canvasBlob(canvas, jpeg ? 'image/jpeg' : 'image/png', quality)
        if (result.size <= MAX_REQUEST_IMAGE_BYTES) return result
      }
      scale *= 0.8
    }
    throw new Error('Image trop volumineuse même après compression. Réduis ses dimensions ou choisis une image plus légère.')
  } finally {
    bitmap.close()
  }
}
