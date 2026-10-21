import { z } from 'zod'
import { api, limit, parseBody } from '~~/server/utils/api'
import { requireUser } from '~~/server/utils/session'
import { fail } from '~~/server/utils/errors'
import { resolveGoogleMapsCoordinates } from '~~/server/services/google-maps'
import type { MapCoordinates } from '~~/shared/map-location'

export default api(async (event) => {
  const user = await requireUser(event)
  limit(event, 'maps-resolve', 20, 60_000, user.id)
  const { input } = await parseBody(event, z.object({ input: z.string().trim().min(1).max(2048) }))
  let coordinates: MapCoordinates | null
  try {
    coordinates = await resolveGoogleMapsCoordinates(input)
  } catch (error) {
    console.error('[maps.resolve] Google Maps link resolution failed', { errorName: error instanceof Error ? error.name : 'UnknownError' })
    return fail(502, 'Impossible de résoudre le lien Google Maps pour le moment. Réessaie ou saisis les coordonnées.', 'map_resolution_failed')
  }
  if (!coordinates) return fail(422, 'Coordonnées introuvables. Vérifie que le lien Google Maps pointe vers un lieu précis.', 'map_coordinates_not_found')
  return coordinates
})
