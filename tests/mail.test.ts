import { afterEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeDb } from './helpers'
import type { Db } from '../server/utils/db'
import { notificationLogs } from '../server/db/schema'
import { sendEmailWithStatus } from '../server/services/mail'

let db: Db

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('envoi des e-mails', () => {
  it('signale une configuration Resend absente au lieu de présenter un e-mail comme envoyé', async () => {
    const previousKey = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      db = await makeDb()
      await expect(sendEmailWithStatus(db, 'client@example.com', 'Billets', '<p>Vos billets</p>'))
        .resolves.toMatchObject({ status: 'not_configured', reason: expect.stringContaining('RESEND_API_KEY') })
      const [log] = await db.select().from(notificationLogs).where(eq(notificationLogs.channel, 'email'))
      expect(log).toMatchObject({ status: 'skipped' })
      expect(log?.response).toContain('RESEND_API_KEY absent')
    } finally {
      if (previousKey === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = previousKey
    }
  })

  it('reconnaît une confirmation et un refus du fournisseur', async () => {
    const previousKey = process.env.RESEND_API_KEY
    const previousFrom = process.env.MAIL_FROM
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.MAIL_FROM = 'TYPS <tickets@example.com>'
    db = await makeDb()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        name: 'validation_error',
        message: 'The sender tickets@example.com is not verified.'
      }), { status: 422 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await expect(sendEmailWithStatus(db, 'client@example.com', 'Billets', '<p>Vos billets</p>'))
        .resolves.toMatchObject({ status: 'sent', httpStatus: 200 })
      await expect(sendEmailWithStatus(db, 'client@example.com', 'Billets', '<p>Vos billets</p>'))
        .resolves.toMatchObject({ status: 'rejected', httpStatus: 422, reason: 'validation_error : The sender [adresse masquée] is not verified.' })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      if (previousKey === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = previousKey
      if (previousFrom === undefined) delete process.env.MAIL_FROM
      else process.env.MAIL_FROM = previousFrom
    }
  })
})
