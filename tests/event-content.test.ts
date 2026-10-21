import { describe, expect, it } from 'vitest'
import { qrContrastOk } from '../composables/useQrPreview'
import { sanitizeEventDescription } from '../server/utils/rich-content'
import { htmlToPlainText, isRichTextEmpty, toEditorHtml } from '../shared/rich-text'
import { getCountdownValues } from '../shared/countdown'
import { openStreetMapEmbedUrl, parseMapCoordinates } from '../shared/map-location'
import { eventTheme, themeById } from '../shared/themes'
import { categorySchema, eventCreateSchema, richDescriptionSchema } from '../shared/validation'

describe('contenu des événements', () => {
  it('nettoie le HTML riche en conservant la mise en forme autorisée', () => {
    expect(sanitizeEventDescription('<p>Bonjour <strong>TYPS</strong></p><script>alert(1)</script>'))
      .toBe('<p>Bonjour <strong>TYPS</strong></p>')
  })

  it('refuse les liens et attributs dangereux dans une description', () => {
    const cleaned = sanitizeEventDescription('<p onclick="alert(1)">Texte</p><a href="javascript:alert(1)">ouvrir</a>')
    expect(cleaned).not.toContain('onclick')
    expect(cleaned).not.toContain('javascript:')
    expect(htmlToPlainText(cleaned)).toContain('Texte\nouvrir')
  })

  it('conserve les mises en forme autorisées et filtre les styles dangereux', () => {
    const cleaned = sanitizeEventDescription('<p style="text-align:center;color:#fff;background-image:url(javascript:alert(1))"><span style="color:#22d3ee">TYPS</span><script>alert(1)</script></p>')
    expect(cleaned).toContain('text-align:center')
    expect(cleaned).toContain('color:#22d3ee')
    expect(cleaned).not.toContain('background-image')
    expect(cleaned).not.toContain('<script')
  })

  it('convertit les anciennes données JSON Tiptap et le texte brut en HTML nettoyé', () => {
    expect(toEditorHtml('Bonjour\nle monde')).toBe('<p>Bonjour</p><p>le monde</p>')
    const legacy = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'TYPS', marks: [{ type: 'bold' }] }] }] })
    expect(toEditorHtml(legacy)).toBe('<div><p><strong>TYPS</strong></p></div>')
    expect(isRichTextEmpty('<p><br></p>')).toBe(true)
  })

  it('applique la limite de description au texte visible et non au balisage', () => {
    const formatted = `<p>${'<strong>TYPS</strong>'.repeat(2000)}</p>`
    expect(richDescriptionSchema.safeParse(formatted).success).toBe(true)
    expect(richDescriptionSchema.safeParse(`<p>${'a'.repeat(20_001)}</p>`).success).toBe(false)
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

  it('retourne des messages précis pour les champs obligatoires et les FAQ incomplètes', () => {
    const base = {
      organizationId: '00000000-0000-4000-8000-000000000000',
      startsAt: '2026-11-01T10:00:00.000Z',
      capacity: 100
    }
    const missingTitle = eventCreateSchema.safeParse(base)
    expect(missingTitle.success).toBe(false)
    if (!missingTitle.success) {
      expect(missingTitle.error.issues.find((issue) => issue.path[0] === 'title')?.message)
        .toBe('Le titre de l’événement est obligatoire.')
    }

    const incompleteFaq = eventCreateSchema.safeParse({
      ...base,
      title: 'Événement TYPS',
      faq: [{ question: 'À quelle heure ouvrent les portes ?', answer: '' }]
    })
    expect(incompleteFaq.success).toBe(false)
    if (!incompleteFaq.success) {
      expect(incompleteFaq.error.issues.find((issue) => issue.path[0] === 'faq')?.message)
        .toBe('La réponse ne peut pas être vide.')
    }
  })

  it('calcule des valeurs cohérentes quand des unités intermédiaires sont masquées', () => {
    const totalSeconds = 93_784
    expect(getCountdownValues(totalSeconds, ['seconds']).seconds).toBe(totalSeconds)
    expect(getCountdownValues(totalSeconds, ['days', 'seconds'])).toMatchObject({ days: 1, seconds: 7_384 })
    expect(getCountdownValues(totalSeconds, ['days', 'hours', 'seconds'])).toMatchObject({ days: 1, hours: 2, seconds: 184 })
    expect(getCountdownValues(totalSeconds, ['days', 'minutes'])).toMatchObject({ days: 1, minutes: 123 })
  })

  it('lit une position à partir de coordonnées ou de liens Google Maps', () => {
    expect(parseMapCoordinates('6.3703, 2.3912')).toEqual({ lat: 6.3703, lng: 2.3912 })
    expect(parseMapCoordinates('https://www.google.com/maps/@6.3703,2.3912,15z')).toEqual({ lat: 6.3703, lng: 2.3912 })
    expect(parseMapCoordinates('https://www.google.com/maps/place/X/data=!3m1!4b1!4m2!3m1!1s0x!3m1!1s0x!8m2!3d6.3703!4d2.3912')).toEqual({ lat: 6.3703, lng: 2.3912 })
    expect(parseMapCoordinates('https://maps.google.com/?q=6.3703%2C+2.3912')).toEqual({ lat: 6.3703, lng: 2.3912 })
    expect(parseMapCoordinates('https://www.google.com/maps/dir/?api=1&destination=6.3703%2C2.3912')).toEqual({ lat: 6.3703, lng: 2.3912 })
    expect(parseMapCoordinates('https://www.google.com/maps/@6.3703,2.3912/data=!2d2.3912!3d6.3703')).toEqual({ lat: 6.3703, lng: 2.3912 })
    expect(parseMapCoordinates('91, 2')).toBeNull()
    expect(parseMapCoordinates('lien sans coordonnées')).toBeNull()
  })

  it('produit une URL de carte OpenStreetMap limitée à des coordonnées valides', () => {
    const url = new URL(openStreetMapEmbedUrl({ lat: 6.3703, lng: 2.3912 }))
    expect(url.origin).toBe('https://www.openstreetmap.org')
    expect(url.pathname).toBe('/export/embed.html')
    expect(url.searchParams.get('marker')).toBe('6.3703,2.3912')
    expect(url.searchParams.get('bbox')).toBe('2.3762,6.3553,2.4062,6.3853')
  })

  it('utilise le thème personnalisé persisté uniquement pour son identifiant', () => {
    const custom = { ...themeById(), id: 'custom-preview', name: 'Aperçu personnalisé' }
    expect(eventTheme('custom-preview', custom)).toEqual(custom)
    expect(eventTheme('custom-other', custom)).toEqual(themeById('custom-other'))
    expect(eventTheme('neon-cyber', custom)).toEqual(themeById('neon-cyber'))
  })

  it('permet de retirer les dates de vente d’une catégorie', () => {
    expect(categorySchema.partial().safeParse({ saleStart: null, saleEnd: null }).success).toBe(true)
  })

  it('n’accepte que les couleurs QR suffisamment contrastées et plus sombres au premier plan', () => {
    expect(qrContrastOk('#000000', '#ffffff')).toBe(true)
    expect(qrContrastOk('#ffffff', '#000000')).toBe(false)
    expect(qrContrastOk('#777777', '#888888')).toBe(false)
  })
})
