import { z } from 'zod'
export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const passwordSchema = z.string().min(10, 'Au moins 10 caractères').max(200)
export const registerSchema = z.object({ email: emailSchema, password: passwordSchema, fullName: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).optional() })
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) })
export const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60)
export const eventCreateSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(8000).default(''),
  category: z.string().trim().max(40).default('soirée'),
  visibility: z.enum(['public', 'private', 'invite']).default('public'),
  startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(),
  timezone: z.string().max(60).default('Africa/Porto-Novo'),
  currency: z.string().length(3).default('XOF'),
  capacity: z.number().int().min(1).max(1_000_000),
  maxPerOrder: z.number().int().min(1).max(50).default(10),
  venueName: z.string().trim().max(160).default(''), address: z.string().trim().max(300).default(''), city: z.string().trim().max(80).default(''),
  lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
  salesOpenAt: z.coerce.date().optional(), salesCloseAt: z.coerce.date().optional(),
  themeId: z.string().max(40).default('neon-cyber')
}).refine((v) => !v.endsAt || v.endsAt >= v.startsAt, { message: 'La fin doit suivre le début', path: ['endsAt'] })
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['free', 'standard', 'vip', 'backstage', 'early_bird', 'group', 'custom']).default('standard'),
  price: z.number().int().min(0).max(100_000_000), quota: z.number().int().min(1).max(1_000_000),
  maxPerOrder: z.number().int().min(1).max(50).optional(),
  saleStart: z.coerce.date().optional(), saleEnd: z.coerce.date().optional(),
  validFrom: z.coerce.date().optional(), validUntil: z.coerce.date().optional(),
  vip: z.boolean().default(false)
})
export const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  items: z.array(z.object({ categoryId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(10),
  buyer: z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, phone: z.string().trim().max(30).optional() }),
  promoCode: z.string().trim().max(40).optional(),
  accessCode: z.string().trim().max(60).optional(),
  acceptTerms: z.literal(true),
  campaign: z.string().trim().max(60).optional(),
  idempotencyKey: z.string().trim().max(80).optional()
})
export const physicalSaleSchema = z.object({
  eventId: z.string().uuid(),
  items: z.array(z.object({ categoryId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1),
  paymentMethod: z.enum(['cash', 'mobile_money', 'card_terminal', 'other']),
  amountReceived: z.number().int().min(0),
  holderName: z.string().trim().max(120).default('Client guichet'),
  buyerEmail: emailSchema.optional(),
  confirmCollected: z.literal(true)
})
export const scanSchema = z.object({ eventId: z.string().uuid(), code: z.string().trim().min(3).max(300), gate: z.string().trim().max(40).default('Porte 1'), deviceId: z.string().max(80).optional() })
export const offlineSyncSchema = z.object({
  eventId: z.string().uuid(), deviceId: z.string().max(80),
  scans: z.array(z.object({ digest: z.string().max(80), scannedAt: z.coerce.date(), gate: z.string().max(40).default('Porte 1') })).max(5000)
})
export const themeCustomSchema = z.object({ id: z.string().max(40), name: z.string().max(60), bg: z.string().regex(/^#[0-9a-f]{6}$/i), surface: z.string().regex(/^#[0-9a-f]{6}$/i), fg: z.string().regex(/^#[0-9a-f]{6}$/i), muted: z.string().regex(/^#[0-9a-f]{6}$/i), a: z.string().regex(/^#[0-9a-f]{6}$/i), b: z.string().regex(/^#[0-9a-f]{6}$/i), line: z.string().regex(/^#[0-9a-f]{6}$/i), radius: z.number().int().min(0).max(40), font: z.enum(['display', 'sans', 'serif', 'mono']), mode: z.enum(['dark', 'light']), blurb: z.string().max(100).default('Thème personnalisé') })
export const feeSettingsSchema = z.object({ platformPercentBp: z.number().int().min(0).max(5000), platformFixedPerTicket: z.number().int().min(0), providerPercentBp: z.number().int().min(0).max(5000), providerFixed: z.number().int().min(0), buyerPaysFees: z.boolean() })
