import { parseMapCoordinates, type MapCoordinates } from '../../shared/map-location'

const SHORT_MAP_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])
const GOOGLE_MAP_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com'])

export async function resolveGoogleMapsCoordinates(input: string, request: typeof fetch = fetch): Promise<MapCoordinates | null> {
  const parsed = parseMapCoordinates(input)
  if (parsed) return parsed

  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !SHORT_MAP_HOSTS.has(url.hostname)) return null

  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await request(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8_000) })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || redirects === 5) return null
      url = new URL(location, url)
      if (url.protocol !== 'https:' || (!SHORT_MAP_HOSTS.has(url.hostname) && !GOOGLE_MAP_HOSTS.has(url.hostname))) return null
      continue
    }
    return response.ok ? parseMapCoordinates(response.url || url.href) : null
  }

  return null
}
