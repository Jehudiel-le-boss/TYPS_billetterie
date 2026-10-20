import { and, eq, inArray, isNull } from 'drizzle-orm'
import { organizationMembers, userNotifications } from '../db/schema'
import type { Db } from '../utils/db'
import { isPlatformFeatureEnabled } from './settings'

export interface NotificationInput {
  userId: string
  kind: string
  title: string
  body: string
  href?: string
}

export async function notifyUsers(db: Db, notifications: NotificationInput[]) {
  if (!notifications.length || !(await isPlatformFeatureEnabled(db, 'inAppNotifications'))) return
  await db.insert(userNotifications).values(notifications.map((n) => ({
    ...n,
    href: n.href ?? null
  })))
}

export async function notifyOrganizationManagers(db: Db, organizationId: string, notification: Omit<NotificationInput, 'userId'>) {
  if (!(await isPlatformFeatureEnabled(db, 'inAppNotifications'))) return
  const managers = await db.select({ userId: organizationMembers.userId }).from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), inArray(organizationMembers.role, ['owner', 'manager']), isNull(organizationMembers.revokedAt)))
  await notifyUsers(db, managers.map(({ userId }) => ({ ...notification, userId })))
}
