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

export interface OrderItemLine {
  name?: string
  quantity?: number
  modifiers?: string
  specialInstructions?: string
  totalPrice?: string
}

export interface OrderDeliveredProps {
  tenantName?: string
  orderNumber?: string
  orderDate?: string
  currency?: string
  items?: OrderItemLine[]
  subtotal?: string
  deliveryFee?: string
  tax?: string
  tip?: string
  total?: string
  branchName?: string
  branchAddress?: string
}

const OrderDeliveredEmail = ({
  tenantName = 'Sashiko Asian Fusion',
  orderNumber = '',
  orderDate = '',
  currency = '',
  items = [],
  subtotal,
  deliveryFee,
  tax,
  tip,
  total,
  branchName,
  branchAddress,
}: OrderDeliveredProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Order #${orderNumber} has been delivered`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="120" alt={tenantName} style={logo} />
        <Heading style={h1}>Your order has been delivered! 🎉</Heading>
        <Text style={muted}>Order #{orderNumber}</Text>
        <Text style={muted}>{orderDate}</Text>

        <table style={itemsTable}>
          <thead>
            <tr>
              <th style={thLeft}>Items</th>
              <th style={thRight}>Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td style={tdLeft}>
                  {item.quantity}x {item.name || 'Unknown Item'}
                  {item.modifiers ? (
                    <>
                      <br />
                      <span style={smallMuted}>{item.modifiers}</span>
                    </>
                  ) : null}
                  {item.specialInstructions ? (
                    <>
                      <br />
                      <span style={smallItalic}>{item.specialInstructions}</span>
                    </>
                  ) : null}
                </td>
                <td style={tdRight}>
                  {currency} {item.totalPrice}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <table style={totalsTable}>
          <tbody>
            <tr>
              <td style={totalLabel}>Subtotal</td>
              <td style={totalValue}>
                {currency} {subtotal}
              </td>
            </tr>
            {deliveryFee ? (
              <tr>
                <td style={totalLabel}>Delivery Fee</td>
                <td style={totalValue}>
                  {currency} {deliveryFee}
                </td>
              </tr>
            ) : null}
            {tax ? (
              <tr>
                <td style={totalLabel}>Tax</td>
                <td style={totalValue}>
                  {currency} {tax}
                </td>
              </tr>
            ) : null}
            {tip ? (
              <tr>
                <td style={totalLabel}>Tip</td>
                <td style={totalValue}>
                  {currency} {tip}
                </td>
              </tr>
            ) : null}
            <tr>
              <td style={grandLabel}>Total</td>
              <td style={grandValue}>
                {currency} {total}
              </td>
            </tr>
          </tbody>
        </table>

        {branchName ? <Text style={branchStrong}>{branchName}</Text> : null}
        {branchAddress ? <Text style={muted}>{branchAddress}</Text> : null}

        <Text style={footer}>Thank you for ordering with {tenantName}!</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderDeliveredEmail,
  subject: (data: Record<string, any>) =>
    `Order #${data.orderNumber ?? ''} — Delivered!`,
  displayName: 'Order delivered',
  previewData: {
    tenantName: 'Sashiko Asian Fusion',
    orderNumber: '042',
    orderDate: 'Friday, August 28, 2026',
    currency: 'EUR',
    items: [
      { name: 'Salmon Nigiri', quantity: 2, modifiers: 'Extra wasabi', totalPrice: '18.00' },
    ],
    subtotal: '18.00',
    deliveryFee: '2.50',
    tax: '1.80',
    total: '22.30',
    branchName: 'Sashiko Nicosia',
    branchAddress: 'Makariou Ave 1, Nicosia',
  },
} satisfies TemplateEntry

const main = { margin: 0, padding: 0, backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 25px' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(0,0%,17%)', margin: '0 0 20px' }
const muted = { fontSize: '14px', color: 'hsl(0,0%,45%)', lineHeight: '1.5', margin: '0 0 8px' }
const smallMuted = { fontSize: '12px', color: 'hsl(0,0%,45%)' }
const smallItalic = { fontSize: '12px', color: 'hsl(0,0%,45%)', fontStyle: 'italic' }
const itemsTable = { width: '100%', borderCollapse: 'collapse' as const, margin: '20px 0' }
const thLeft = { textAlign: 'left' as const, padding: '8px 0', borderBottom: '2px solid hsl(43,48%,58%)', color: 'hsl(0,0%,17%)', fontSize: '13px' }
const thRight = { textAlign: 'right' as const, padding: '8px 0', borderBottom: '2px solid hsl(43,48%,58%)', color: 'hsl(0,0%,17%)', fontSize: '13px' }
const tdLeft = { padding: '8px 0', borderBottom: '1px solid #eee', color: '#2b2b2b', fontSize: '14px' }
const tdRight = { padding: '8px 0', borderBottom: '1px solid #eee', textAlign: 'right' as const, color: '#2b2b2b', fontSize: '14px' }
const totalsTable = { width: '100%', marginBottom: '24px' }
const totalLabel = { padding: '4px 0', fontSize: '14px', color: 'hsl(0,0%,45%)' }
const totalValue = { textAlign: 'right' as const, fontSize: '14px', color: 'hsl(0,0%,45%)' }
const grandLabel = { padding: '8px 0', fontSize: '16px', fontWeight: 'bold', color: 'hsl(0,0%,17%)', borderTop: '2px solid hsl(43,48%,58%)' }
const grandValue = { textAlign: 'right' as const, padding: '8px 0', fontSize: '16px', fontWeight: 'bold', color: 'hsl(0,0%,17%)', borderTop: '2px solid hsl(43,48%,58%)' }
const branchStrong = { fontSize: '13px', color: 'hsl(0,0%,45%)', fontWeight: 'bold', margin: '0 0 4px' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
