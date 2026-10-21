export interface MapCoordinates {
  lat: number
  lng: number
}

function validCoordinates(latValue: string, lngValue: string): MapCoordinates | null {
  const lat = Number(latValue)
  const lng = Number(lngValue)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null
}

export function parseMapCoordinates(value: string): MapCoordinates | null {
  const raw = value.trim().replace(/&amp;/g, '&').replace(/&#x2c;|&#44;/gi, ',')
  if (!raw) return null
  const inputs = [raw]
  try {
    const decoded = decodeURIComponent(raw.replace(/\+/g, '%20'))
    if (decoded !== raw) inputs.push(decoded)
  } catch (error) {
    if (!(error instanceof URIError)) throw error
  }

  const candidates = [
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /!2d(-?\d{1,3}(?:\.\d+)?)!3d(-?\d{1,2}(?:\.\d+)?)/,
    /(?:q|query|ll|center|destination|origin)=(-?\d{1,2}(?:\.\d+)?)(?:%2c|,|\+|\s)+(-?\d{1,3}(?:\.\d+)?)/i,
    /^(-?\d{1,2}(?:\.\d+)?)(?:,|\s)+(-?\d{1,3}(?:\.\d+)?)$/
  ]

  for (const input of inputs) {
    for (const pattern of candidates) {
      const match = input.match(pattern)
      if (!match) continue
      const reversed = pattern.source.startsWith('!2d')
      const coordinates = validCoordinates(reversed ? match[2]! : match[1]!, reversed ? match[1]! : match[2]!)
      if (coordinates) return coordinates
    }
  }

  return null
}

export function openStreetMapEmbedUrl({ lat, lng }: MapCoordinates): string {
  const span = 0.015
  const left = Math.max(-180, lng - span)
  const bottom = Math.max(-90, lat - span)
  const right = Math.min(180, lng + span)
  const top = Math.min(90, lat + span)
  const params = new URLSearchParams({
    bbox: [left, bottom, right, top].map((coordinate) => String(Number(coordinate.toFixed(6)))).join(','),
    layer: 'mapnik',
    marker: `${lat},${lng}`
  })
  return `https://www.openstreetmap.org/export/embed.html?${params}`
}
