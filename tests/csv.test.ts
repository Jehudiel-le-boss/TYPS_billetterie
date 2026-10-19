import { describe, expect, it } from 'vitest'
import { parseGuestsCsv, toCsv } from '../server/services/csv'
describe('import CSV des invités', () => {
  it('accepte , et ; et signale les erreurs ligne par ligne', () => {
    const r = parseGuestsCsv('nom;email\nAïcha Dossou;aicha@x.io\nX;bad\nKoffi Mensah;nope@\nFatou Diallo;\nAïcha Dossou;aicha@x.io')
    expect(r.rows.map((x) => x.name)).toEqual(['Aïcha Dossou', 'Fatou Diallo'])
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 6])
  })
  it('colonne nom absente → erreur claire', () => expect(parseGuestsCsv('foo,bar\n1,2').errors[0]!.message).toMatch(/nom/))
  it('fichier vide', () => expect(parseGuestsCsv('').errors).toHaveLength(1))
  it('l’export neutralise l’injection de formules', () => expect(toCsv(['a'], [['=HYPERLINK("x")'], ['ok']])).toContain("'=HYPERLINK"))
})
