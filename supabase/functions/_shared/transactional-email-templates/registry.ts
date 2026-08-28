import type { ComponentType } from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as orderDeliveredTemplate } from './order-delivered.tsx'
import { template as reservationStatusTemplate } from './reservation-status.tsx'
import { template as broadcastAnnouncementTemplate } from './broadcast-announcement.tsx'

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-delivered': orderDeliveredTemplate,
  'reservation-status': reservationStatusTemplate,
  'broadcast-announcement': broadcastAnnouncementTemplate,
}
