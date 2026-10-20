// Schéma Neon PostgreSQL (Drizzle). Montants = entiers (unité mineure). Horodatages en UTC (timestamptz).
// Voir DATABASE.md pour les écarts documentés par rapport à la liste du cahier des charges.
import { sql } from 'drizzle-orm'
import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, index, uniqueIndex, check } from 'drizzle-orm/pg-core'

const id = () => uuid('id').primaryKey().defaultRandom()
const ts = (n: string) => timestamp(n, { withTimezone: true, mode: 'date' })
const createdAt = () => ts('created_at').notNull().defaultNow()

export const platformRole = pgEnum('platform_role', ['user', 'admin'])
export const orgRole = pgEnum('org_role', ['owner', 'manager', 'seller', 'agent', 'viewer'])
export const eventStatus = pgEnum('event_status', ['draft', 'published', 'suspended', 'closed', 'cancelled'])
export const visibility = pgEnum('event_visibility', ['public', 'private', 'invite'])
export const categoryKind = pgEnum('category_kind', ['free', 'standard', 'vip', 'backstage', 'early_bird', 'group', 'custom'])
export const orderStatus = pgEnum('order_status', ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded', 'partially_refunded'])
export const channel = pgEnum('sales_channel', ['online', 'physical', 'guest', 'import'])
export const ticketStatus = pgEnum('ticket_status', ['valid', 'used', 'cancelled', 'refunded', 'suspended'])
export const paymentStatus = pgEnum('payment_status', ['initiated', 'pending', 'approved', 'declined', 'canceled', 'refunded', 'failed'])
export const scanResult = pgEnum('scan_result', ['accepted', 'already_used', 'invalid', 'cancelled', 'refunded', 'suspended', 'wrong_event', 'not_started'])

export const users = pgTable('users', {
  id: id(), email: text('email').notNull(), passwordHash: text('password_hash'),
  neonAuthUserId: text('neon_auth_user_id').unique(),
  emailVerifiedAt: ts('email_verified_at'), platformRole: platformRole('platform_role').notNull().default('user'),
  status: text('status').notNull().default('active'), createdAt: createdAt(), deletedAt: ts('deleted_at')
}, (t) => [uniqueIndex('users_email_uq').on(sql`lower(${t.email})`)])

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(), phone: text('phone'), locale: text('locale').notNull().default('fr'), avatarKey: text('avatar_key'), updatedAt: createdAt()
})
export const sessions = pgTable('sessions', {
  id: id(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), tokenHash: text('token_hash').notNull().unique(),
  expiresAt: ts('expires_at').notNull(), revokedAt: ts('revoked_at'), ip: text('ip'), userAgent: text('user_agent'), createdAt: createdAt()
}, (t) => [index('sessions_user_idx').on(t.userId)])
export const authTokens = pgTable('auth_tokens', {
  id: id(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), kind: text('kind').notNull(),
  tokenHash: text('token_hash').notNull().unique(), expiresAt: ts('expires_at').notNull(), usedAt: ts('used_at'), createdAt: createdAt()
})

export const organizations = pgTable('organizations', {
  id: id(), name: text('name').notNull(), slug: text('slug').notNull().unique(), plan: text('plan').notNull().default('free'),
  currency: text('currency').notNull().default('XOF'), logoKey: text('logo_key'), brandTheme: jsonb('brand_theme'),
  payoutInfo: jsonb('payout_info'), status: text('status').notNull().default('active'), createdAt: createdAt(), deletedAt: ts('deleted_at')
})
export const organizationMembers = pgTable('organization_members', {
  id: id(), organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), role: orgRole('role').notNull(),
  createdAt: createdAt(), revokedAt: ts('revoked_at')
}, (t) => [uniqueIndex('org_member_uq').on(t.organizationId, t.userId), index('org_member_user_idx').on(t.userId)])
export const organizationInvitations = pgTable('organization_invitations', {
  id: id(), organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(), role: orgRole('role').notNull(), tokenHash: text('token_hash').notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.id), expiresAt: ts('expires_at').notNull(), acceptedAt: ts('accepted_at'), createdAt: createdAt()
})

export const ticketTemplates = pgTable('ticket_templates', {
  id: id(), organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }), name: text('name').notNull(),
  draftLayout: jsonb('draft_layout').notNull(), currentVersionId: uuid('current_version_id'), isPremium: boolean('is_premium').notNull().default(false),
  isPublicLibrary: boolean('is_public_library').notNull().default(false), createdAt: createdAt(), updatedAt: ts('updated_at').notNull().defaultNow(), deletedAt: ts('deleted_at')
}, (t) => [index('tpl_org_idx').on(t.organizationId)])
export const ticketTemplateVersions = pgTable('ticket_template_versions', {
  id: id(), templateId: uuid('template_id').notNull().references(() => ticketTemplates.id, { onDelete: 'cascade' }), version: integer('version').notNull(),
  layout: jsonb('layout').notNull(), createdBy: uuid('created_by').references(() => users.id), createdAt: createdAt()
}, (t) => [uniqueIndex('tpl_version_uq').on(t.templateId, t.version)])
export const ticketTemplateAssets = pgTable('ticket_template_assets', {
  id: id(), organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), storageKey: text('storage_key').notNull().unique(), mime: text('mime').notNull(), bytes: integer('bytes').notNull(),
  width: integer('width'), height: integer('height'), createdBy: uuid('created_by').references(() => users.id), createdAt: createdAt()
})

export const events = pgTable('events', {
  id: id(), organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(), title: text('title').notNull(), description: text('description').notNull().default(''), category: text('category').notNull().default('soirée'),
  status: eventStatus('status').notNull().default('draft'), visibility: visibility('visibility').notNull().default('public'),
  shareToken: text('share_token').notNull().unique(), accessCodeHash: text('access_code_hash'),
  startsAt: ts('starts_at').notNull(), endsAt: ts('ends_at'), timezone: text('timezone').notNull().default('Africa/Porto-Novo'), currency: text('currency').notNull().default('XOF'),
  capacity: integer('capacity').notNull(), maxPerOrder: integer('max_per_order').notNull().default(10),
  salesOpenAt: ts('sales_open_at'), salesCloseAt: ts('sales_close_at'),
  offlineEnabled: boolean('offline_enabled').notNull().default(false), transfersEnabled: boolean('transfers_enabled').notNull().default(false),
  templateId: uuid('template_id').references(() => ticketTemplates.id, { onDelete: 'set null' }), posterKey: text('poster_key'), galleryKeys: jsonb('gallery_keys').$type<string[]>().notNull().default([]),
  faq: jsonb('faq').$type<{ question: string; answer: string }[]>().notNull().default([]),
  countdownEnabled: boolean('countdown_enabled').notNull().default(true),
  countdownUnits: jsonb('countdown_units').$type<('days' | 'hours' | 'minutes' | 'seconds')[]>().notNull().default(['days', 'hours', 'minutes', 'seconds']),
  themeId: text('theme_id').notNull().default('neon-cyber'), accessTerms: text('access_terms').notNull().default(''),
  refundPolicy: jsonb('refund_policy').$type<{ allowed: boolean; untilHoursBefore: number }>().notNull().default({ allowed: false, untilHoursBefore: 48 }),
  isDemo: boolean('is_demo').notNull().default(false), moderation: text('moderation').notNull().default('ok'),
  createdAt: createdAt(), updatedAt: ts('updated_at').notNull().defaultNow(), deletedAt: ts('deleted_at')
}, (t) => [index('events_org_idx').on(t.organizationId), index('events_pub_idx').on(t.status, t.visibility, t.startsAt)])
export const eventLocations = pgTable('event_locations', {
  id: id(), eventId: uuid('event_id').notNull().unique().references(() => events.id, { onDelete: 'cascade' }),
  venueName: text('venue_name').notNull().default(''), address: text('address').notNull().default(''), city: text('city').notNull().default(''), country: text('country').notNull().default('BJ'),
  lat: doublePrecision('lat'), lng: doublePrecision('lng')
})
export const ticketCategories = pgTable('ticket_categories', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), name: text('name').notNull(), kind: categoryKind('kind').notNull().default('standard'),
  price: integer('price').notNull(), quota: integer('quota').notNull(), sold: integer('sold').notNull().default(0), reserved: integer('reserved').notNull().default(0),
  maxPerOrder: integer('max_per_order'), saleStart: ts('sale_start'), saleEnd: ts('sale_end'), validFrom: ts('valid_from'), validUntil: ts('valid_until'),
  zones: jsonb('zones').$type<string[]>().notNull().default([]), vip: boolean('vip').notNull().default(false), position: integer('position').notNull().default(0),
  createdAt: createdAt(), deletedAt: ts('deleted_at')
}, (t) => [index('cat_event_idx').on(t.eventId),
  check('cat_stock_ck', sql`${t.sold} >= 0 AND ${t.reserved} >= 0 AND ${t.sold} + ${t.reserved} <= ${t.quota}`),
  check('cat_price_ck', sql`${t.price} >= 0`)])

export const orders = pgTable('orders', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id), organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  buyerName: text('buyer_name').notNull(), buyerEmail: text('buyer_email').notNull(), buyerPhone: text('buyer_phone'),
  status: orderStatus('status').notNull().default('pending'), channel: channel('channel').notNull().default('online'), currency: text('currency').notNull(),
  subtotal: integer('subtotal').notNull(), discount: integer('discount').notNull().default(0), buyerFees: integer('buyer_fees').notNull().default(0), total: integer('total').notNull(),
  providerFee: integer('provider_fee').notNull().default(0), platformFee: integer('platform_fee').notNull().default(0), organizerNet: integer('organizer_net').notNull().default(0),
  promoCodeId: uuid('promo_code_id'), accessTokenHash: text('access_token_hash').notNull(), expiresAt: ts('expires_at'), paidAt: ts('paid_at'),
  sellerId: uuid('seller_id').references(() => users.id), paymentMethod: text('payment_method'), campaign: text('campaign'), isDemo: boolean('is_demo').notNull().default(false),
  idempotencyKey: text('idempotency_key').unique(), createdAt: createdAt(), updatedAt: ts('updated_at').notNull().defaultNow()
}, (t) => [index('orders_event_idx').on(t.eventId, t.status), index('orders_email_idx').on(t.buyerEmail), index('orders_exp_idx').on(t.status, t.expiresAt)])
export const orderItems = pgTable('order_items', {
  id: id(), orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }), categoryId: uuid('category_id').notNull().references(() => ticketCategories.id),
  quantity: integer('quantity').notNull(), unitPrice: integer('unit_price').notNull(), lineTotal: integer('line_total').notNull()
}, (t) => [index('items_order_idx').on(t.orderId), check('items_qty_ck', sql`${t.quantity} > 0`)])
export const payments = pgTable('payments', {
  id: id(), orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }), provider: text('provider').notNull(), providerTxId: text('provider_tx_id'),
  reference: text('reference').notNull().unique(), status: paymentStatus('status').notNull().default('initiated'), amount: integer('amount').notNull(), currency: text('currency').notNull(),
  raw: jsonb('raw'), verifiedAt: ts('verified_at'), createdAt: createdAt(), updatedAt: ts('updated_at').notNull().defaultNow()
}, (t) => [uniqueIndex('pay_provider_tx_uq').on(t.provider, t.providerTxId), index('pay_order_idx').on(t.orderId)])
export const paymentWebhookEvents = pgTable('payment_webhook_events', {
  id: id(), provider: text('provider').notNull(), dedupeKey: text('dedupe_key').notNull().unique(), eventName: text('event_name'), providerTxId: text('provider_tx_id'),
  payload: jsonb('payload').notNull(), signatureOk: boolean('signature_ok').notNull(), processedAt: ts('processed_at'), error: text('error'), receivedAt: createdAt()
})
export const refunds = pgTable('refunds', {
  id: id(), orderId: uuid('order_id').notNull().references(() => orders.id), paymentId: uuid('payment_id').references(() => payments.id), amount: integer('amount').notNull(),
  reason: text('reason').notNull(), status: text('status').notNull().default('requested'), requestedBy: text('requested_by'), decidedBy: uuid('decided_by').references(() => users.id),
  providerRef: text('provider_ref'), evidenceKey: text('evidence_key'), createdAt: createdAt(), processedAt: ts('processed_at')
}, (t) => [index('refund_order_idx').on(t.orderId)])

export const ticketBatches = pgTable('ticket_batches', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), categoryId: uuid('category_id').notNull().references(() => ticketCategories.id),
  source: channel('source').notNull(), orderId: uuid('order_id').references(() => orders.id), quantity: integer('quantity').notNull(), createdBy: uuid('created_by').references(() => users.id), createdAt: createdAt()
})
export const tickets = pgTable('tickets', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id), categoryId: uuid('category_id').notNull().references(() => ticketCategories.id),
  orderId: uuid('order_id').references(() => orders.id), batchId: uuid('batch_id').references(() => ticketBatches.id), ref: text('ref').notNull().unique(),
  holderName: text('holder_name').notNull(), holderEmail: text('holder_email'), status: ticketStatus('status').notNull().default('valid'), qrVersion: integer('qr_version').notNull().default(1),
  pricePaid: integer('price_paid').notNull().default(0), currency: text('currency').notNull(), source: channel('source').notNull().default('online'), isDemo: boolean('is_demo').notNull().default(false),
  issuedAt: createdAt(), usedAt: ts('used_at'), usedBy: uuid('used_by').references(() => users.id), cancelledAt: ts('cancelled_at')
}, (t) => [index('tk_event_idx').on(t.eventId, t.status), index('tk_order_idx').on(t.orderId)])
export const checkIns = pgTable('check_ins', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), ticketId: uuid('ticket_id').references(() => tickets.id), result: scanResult('result').notNull(),
  gate: text('gate').notNull().default('Porte 1'), agentId: uuid('agent_id').references(() => users.id), deviceId: text('device_id'), source: text('source').notNull().default('online'),
  conflict: boolean('conflict').notNull().default(false), direction: text('direction').notNull().default('in'), scannedAt: ts('scanned_at').notNull().defaultNow(), createdAt: createdAt()
}, (t) => [index('ci_event_idx').on(t.eventId, t.scannedAt), index('ci_ticket_idx').on(t.ticketId)])
export const scannerSessions = pgTable('scanner_sessions', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), userId: uuid('user_id').notNull().references(() => users.id),
  gate: text('gate').notNull(), deviceLabel: text('device_label'), startedAt: createdAt(), lastSeenAt: ts('last_seen_at').notNull().defaultNow(), endedAt: ts('ended_at'), revokedAt: ts('revoked_at')
})
export const eventStaff = pgTable('event_staff', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  canScan: boolean('can_scan').notNull().default(true), canSell: boolean('can_sell').notNull().default(false), gates: jsonb('gates').$type<string[]>().notNull().default([]),
  createdAt: createdAt(), revokedAt: ts('revoked_at')
}, (t) => [uniqueIndex('staff_uq').on(t.eventId, t.userId)])
export const offlineScanSyncs = pgTable('offline_scan_syncs', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), deviceId: text('device_id').notNull(), userId: uuid('user_id').references(() => users.id),
  scansCount: integer('scans_count').notNull(), accepted: integer('accepted').notNull(), conflicts: integer('conflicts').notNull(), receivedAt: createdAt()
})

export const guestLists = pgTable('guest_lists', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), name: text('name').notNull(), kind: text('kind').notNull().default('vip'), createdAt: createdAt()
})
export const invitations = pgTable('invitations', {
  id: id(), guestListId: uuid('guest_list_id').notNull().references(() => guestLists.id, { onDelete: 'cascade' }), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), email: text('email'), code: text('code').notNull().unique(), status: text('status').notNull().default('invited'), ticketId: uuid('ticket_id').references(() => tickets.id), createdAt: createdAt()
})
export const promoCodes = pgTable('promo_codes', {
  id: id(), organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  code: text('code').notNull(), kind: text('kind').notNull(), value: integer('value').notNull(), startsAt: ts('starts_at'), endsAt: ts('ends_at'), maxUses: integer('max_uses'), maxPerUser: integer('max_per_user').notNull().default(1),
  categoryIds: jsonb('category_ids').$type<string[]>().notNull().default([]), usedCount: integer('used_count').notNull().default(0), active: boolean('active').notNull().default(true), createdAt: createdAt()
}, (t) => [uniqueIndex('promo_uq').on(t.eventId, t.code), check('promo_val_ck', sql`${t.value} > 0`)])
export const promoCodeRedemptions = pgTable('promo_code_redemptions', {
  id: id(), promoCodeId: uuid('promo_code_id').notNull().references(() => promoCodes.id, { onDelete: 'cascade' }), orderId: uuid('order_id').notNull().unique().references(() => orders.id, { onDelete: 'cascade' }),
  buyerEmail: text('buyer_email').notNull(), amountDiscounted: integer('amount_discounted').notNull(), createdAt: createdAt()
})
export const waitlistEntries = pgTable('waitlist_entries', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), categoryId: uuid('category_id').notNull().references(() => ticketCategories.id),
  email: text('email').notNull(), name: text('name').notNull(), quantity: integer('quantity').notNull().default(1), status: text('status').notNull().default('waiting'),
  offerTokenHash: text('offer_token_hash'), offerExpiresAt: ts('offer_expires_at'), createdAt: createdAt()
}, (t) => [uniqueIndex('wl_uq').on(t.categoryId, t.email)])
export const ticketTransfers = pgTable('ticket_transfers', {
  id: id(), ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }), fromEmail: text('from_email'), toEmail: text('to_email').notNull(), toName: text('to_name').notNull(),
  status: text('status').notNull().default('pending'), tokenHash: text('token_hash').notNull().unique(), expiresAt: ts('expires_at').notNull(), completedAt: ts('completed_at'), createdAt: createdAt()
})
export const eventReports = pgTable('event_reports', {
  id: id(), eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), reporterEmail: text('reporter_email'), reason: text('reason').notNull(), status: text('status').notNull().default('open'), createdAt: createdAt()
})

export const notificationJobs = pgTable('notification_jobs', {
  id: id(), kind: text('kind').notNull(), toEmail: text('to_email').notNull(), payload: jsonb('payload').notNull(), status: text('status').notNull().default('queued'), attempts: integer('attempts').notNull().default(0),
  runAt: ts('run_at').notNull().defaultNow(), createdAt: createdAt()
}, (t) => [index('nj_status_idx').on(t.status, t.runAt)])
export const notificationLogs = pgTable('notification_logs', {
  id: id(), jobId: uuid('job_id').references(() => notificationJobs.id, { onDelete: 'set null' }), channel: text('channel').notNull().default('email'), status: text('status').notNull(), response: text('response'), createdAt: createdAt()
})
export const userNotifications = pgTable('user_notifications', {
  id: id(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), title: text('title').notNull(), body: text('body').notNull(), href: text('href'),
  readAt: ts('read_at'), createdAt: createdAt()
}, (t) => [index('user_notifications_user_created_idx').on(t.userId, t.createdAt), index('user_notifications_unread_idx').on(t.userId, t.readAt)])
export const settlements = pgTable('settlements', {
  id: id(), organizationId: uuid('organization_id').notNull().references(() => organizations.id), eventId: uuid('event_id').references(() => events.id),
  periodStart: ts('period_start'), periodEnd: ts('period_end'), gross: integer('gross').notNull().default(0), providerFees: integer('provider_fees').notNull().default(0), platformFees: integer('platform_fees').notNull().default(0),
  net: integer('net').notNull().default(0), status: text('status').notNull().default('pending'), method: text('method').notNull().default('manual'), reference: text('reference'), notes: text('notes'),
  paidAt: ts('paid_at'), createdBy: uuid('created_by').references(() => users.id), createdAt: createdAt()
})
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(), value: jsonb('value').notNull(), updatedBy: uuid('updated_by').references(() => users.id), updatedAt: ts('updated_at').notNull().defaultNow()
})
export const auditLogs = pgTable('audit_logs', {
  id: id(), actorId: uuid('actor_id'), organizationId: uuid('organization_id'), action: text('action').notNull(), entityType: text('entity_type'), entityId: text('entity_id'),
  meta: jsonb('meta'), ip: text('ip'), createdAt: createdAt()
}, (t) => [index('audit_org_idx').on(t.organizationId, t.createdAt), index('audit_action_idx').on(t.action)])
