import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL =
  'https://rfwqbzeutrfccaazvibc.supabase.co/storage/v1/object/public/restaurant-images/email%2Fsashiko-logo.png'

export interface BroadcastAnnouncementProps {
  tenantName?: string
  title?: string
  message?: string
}

const BroadcastAnnouncementEmail = ({
  tenantName = 'Sashiko Asian Fusion',
  title = '',
  message = '',
}: BroadcastAnnouncementProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="120" alt={tenantName} style={logo} />
        <Heading style={h1}>{title}</Heading>
        {message.split('\n').map((line, index) => (
          <Text key={index} style={body}>
            {line}
          </Text>
        ))}
        <Text style={footer}>{tenantName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BroadcastAnnouncementEmail,
  subject: (data: Record<string, any>) => String(data.title ?? 'Notification'),
  displayName: 'Announcement',
  previewData: {
    tenantName: 'Sashiko Asian Fusion',
    title: 'Weekend Special Offer!',
    message: 'Join us this weekend for a new seasonal menu.',
  },
} satisfies TemplateEntry

const main = { margin: 0, padding: 0, backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 25px' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(0,0%,17%)', margin: '0 0 20px' }
const body = { fontSize: '14px', color: 'hsl(0,0%,45%)', lineHeight: '1.6', margin: '0 0 12px' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
