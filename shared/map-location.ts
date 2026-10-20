export interface MapCoordinates {
  lat: number
  lng: number
}

export function parseMapCoordinates(value: string): MapCoordinates | null {
  const decoded = value.trim().replace(/&amp;/g, '&')
  if (!decoded) return null

  const candidates = [
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /(?:q|query)=(-?\d{1,2}(?:\.\d+)?)(?:%2C|,|\s)+(-?\d{1,3}(?:\.\d+)?)/i,
    /^(-?\d{1,2}(?:\.\d+)?)(?:,|\s)+(-?\d{1,3}(?:\.\d+)?)$/
  ]

  for (const pattern of candidates) {
    const match = decoded.match(pattern)
    if (!match) continue
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }

  return null
}
