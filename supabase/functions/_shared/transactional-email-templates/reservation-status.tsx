import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const LOGO_URL =
  'https://rfwqbzeutrfccaazvibc.supabase.co/storage/v1/object/public/restaurant-images/email%2Fsashiko-logo.png'

export interface ReservationStatusProps {
  tenantName?: string
  approved?: boolean
  reservationDate?: string
  startTime?: string
  endTime?: string
  partySize?: number
  specialRequests?: string
  adminNotes?: string
  branchName?: string
  branchAddress?: string
  branchPhone?: string
}

const ReservationStatusEmail = ({
  tenantName = 'Sashiko Asian Fusion',
  approved = true,
  reservationDate = '',
  startTime = '',
  endTime = '',
  partySize = 1,
  specialRequests,
  adminNotes,
  branchName,
  branchAddress,
  branchPhone,
}: ReservationStatusProps) => {
  const statusTitle = approved
    ? 'Your reservation is confirmed!'
    : 'Your reservation has been cancelled'
  const statusColor = approved ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{statusTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="120" alt={tenantName} style={logo} />
          <Heading style={h1}>{statusTitle}</Heading>

          <Section style={card}>
            <table style={detailsTable}>
              <tbody>
                <tr>
                  <td style={label}>Date</td>
                  <td style={value}>{reservationDate}</td>
                </tr>
                <tr>
                  <td style={label}>Time</td>
                  <td style={value}>
                    {startTime} — {endTime}
                  </td>
                </tr>
                <tr>
                  <td style={label}>Party Size</td>
                  <td style={value}>
                    {partySize} {partySize === 1 ? 'guest' : 'guests'}
                  </td>
                </tr>
                <tr>
                  <td style={label}>Status</td>
                  <td style={{ ...value, color: statusColor }}>
                    {approved ? 'Confirmed' : 'Cancelled'}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {specialRequests ? (
            <Text style={note}>Special Requests: {specialRequests}</Text>
          ) : null}
          {adminNotes ? (
            <Text style={note}>Note from restaurant: {adminNotes}</Text>
          ) : null}

          {branchName ? <Text style={branchStrong}>{branchName}</Text> : null}
          {branchAddress ? <Text style={note}>{branchAddress}</Text> : null}
          {branchPhone ? <Text style={note}>{branchPhone}</Text> : null}

          <Text style={footer}>{tenantName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReservationStatusEmail,
  subject: (data: Record<string, any>) =>
    data.approved === false ? 'Reservation Cancelled' : 'Reservation Confirmed ✅',
  displayName: 'Reservation status',
  previewData: {
    tenantName: 'Sashiko Asian Fusion',
    approved: true,
    reservationDate: 'Friday, August 28, 2026',
    startTime: '19:00',
    endTime: '21:00',
    partySize: 4,
    branchName: 'Sashiko Nicosia',
    branchAddress: 'Makariou Ave 1, Nicosia',
    branchPhone: '+357 22 000000',
  },
} satisfies TemplateEntry

const main = { margin: 0, padding: 0, backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 25px' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(0,0%,17%)', margin: '0 0 20px' }
const card = { background: 'hsl(43,30%,95%)', borderRadius: '0.5rem', padding: '20px', marginBottom: '24px' }
const detailsTable = { width: '100%' }
const label = { padding: '6px 0', fontSize: '14px', color: 'hsl(0,0%,45%)' }
const value = { textAlign: 'right' as const, fontSize: '14px', color: 'hsl(0,0%,17%)', fontWeight: 600 }
const note = { fontSize: '13px', color: 'hsl(0,0%,45%)', margin: '0 0 16px' }
const branchStrong = { fontSize: '13px', color: 'hsl(0,0%,45%)', fontWeight: 'bold', margin: '0 0 4px' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
