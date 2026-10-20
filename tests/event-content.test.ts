import { describe, expect, it } from 'vitest'
import { qrContrastOk } from '../composables/useQrPreview'
import { sanitizeEventDescription } from '../server/utils/rich-content'
import { getCountdownValues } from '../shared/countdown'
import { eventCreateSchema } from '../shared/validation'

describe('contenu des événements', () => {
  it('nettoie le HTML riche en conservant la mise en forme autorisée', () => {
    expect(sanitizeEventDescription('<p>Bonjour <strong>TYPS</strong></p><script>alert(1)</script>'))
      .toBe('<p>Bonjour <strong>TYPS</strong></p>')
  })

  it('refuse les liens et attributs dangereux dans une description', () => {
    expect(sanitizeEventDescription('<p onclick="alert(1)">Texte</p><a href="javascript:alert(1)">ouvrir</a>'))
      .toBe('<p>Texte</p>ouvrir')
  })

  it('valide la plage de dates et les unités du compte à rebours', () => {
    const base = {
      organizationId: '00000000-0000-4000-8000-000000000000',
      title: 'Événement TYPS',
      startsAt: '2026-11-01T10:00:00.000Z',
      capacity: 100
    }
    expect(eventCreateSchema.safeParse({ ...base, endsAt: '2026-11-01T09:00:00.000Z' }).success).toBe(false)
    expect(eventCreateSchema.safeParse({ ...base, countdownUnits: ['hours', 'hours'] }).success).toBe(false)
    expect(eventCreateSchema.safeParse({ ...base, countdownEnabled: true, countdownUnits: [] }).success).toBe(false)
  })

  it('calcule des valeurs cohérentes quand des unités intermédiaires sont masquées', () => {
    const totalSeconds = 93_784
    expect(getCountdownValues(totalSeconds, ['seconds']).seconds).toBe(totalSeconds)
    expect(getCountdownValues(totalSeconds, ['days', 'seconds'])).toMatchObject({ days: 1, seconds: 7_384 })
    expect(getCountdownValues(totalSeconds, ['days', 'hours', 'seconds'])).toMatchObject({ days: 1, hours: 2, seconds: 184 })
    expect(getCountdownValues(totalSeconds, ['days', 'minutes'])).toMatchObject({ days: 1, minutes: 123 })
  })

  it('n’accepte que les couleurs QR suffisamment contrastées et plus sombres au premier plan', () => {
    expect(qrContrastOk('#000000', '#ffffff')).toBe(true)
    expect(qrContrastOk('#ffffff', '#000000')).toBe(false)
    expect(qrContrastOk('#777777', '#888888')).toBe(false)
  })
})
