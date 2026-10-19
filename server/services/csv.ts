// Import CSV des invités : validation ligne par ligne avec aperçu des erreurs (pur, testable sans base).
export interface GuestRow { line: number; name: string; email: string | null }
export interface CsvPreview { rows: GuestRow[]; errors: { line: number; message: string }[]; total: number }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function splitLine(l: string, sep: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (let i = 0; i < l.length; i++) {
    const c = l[i]!
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c } else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur); return out.map((s) => s.trim())
}
export function parseGuestsCsv(text: string, maxRows = 2000): CsvPreview {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const errors: CsvPreview['errors'] = []; const rows: GuestRow[] = []
  if (!lines.length) return { rows, errors: [{ line: 1, message: 'Fichier vide' }], total: 0 }
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ';' : ','
  const head = splitLine(lines[0]!, sep).map((h) => h.toLowerCase())
  const iName = head.findIndex((h) => ['nom', 'name', 'nom complet', 'full name'].includes(h)), iMail = head.findIndex((h) => ['email', 'e-mail', 'courriel', 'mail'].includes(h))
  if (iName < 0) return { rows, errors: [{ line: 1, message: 'Colonne « nom » (ou « name ») introuvable' }], total: lines.length - 1 }
  if (lines.length - 1 > maxRows) errors.push({ line: 0, message: `Limite de ${maxRows} lignes dépassée` })
  const seen = new Set<string>()
  lines.slice(1, maxRows + 1).forEach((l, idx) => {
    const line = idx + 2, c = splitLine(l, sep), name = (c[iName] ?? '').slice(0, 120), email = iMail >= 0 ? (c[iMail] ?? '').toLowerCase() : ''
    if (name.length < 2) return void errors.push({ line, message: 'Nom manquant ou trop court' })
    if (email && !EMAIL.test(email)) return void errors.push({ line, message: `E-mail invalide : ${email.slice(0, 40)}` })
    const key = email || name.toLowerCase()
    if (seen.has(key)) return void errors.push({ line, message: 'Doublon dans le fichier' })
    seen.add(key); rows.push({ line, name, email: email || null })
  })
  return { rows, errors, total: lines.length - 1 }
}
export const toCsv = (header: string[], data: (string | number | null | undefined)[][]) => {
  const cell = (v: unknown) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s } // neutralise l'injection de formules
  return '\uFEFF' + [header, ...data].map((r) => r.map(cell).join(',')).join('\r\n')
}
