import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface GuestRequestEmailProps {
  guestEmail?: string
  guestName?: string | null
  requestedAt?: string
  approveUrl?: string
}

const GuestRequestEmail = ({
  guestEmail = 'someone@example.com',
  guestName,
  requestedAt,
  approveUrl,
}: GuestRequestEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New guest account request: {guestEmail}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <Img
            src="https://fharchive.com/__l5e/assets-v1/f9b37994-85ba-4cde-b07a-a2698f053834/email-logo.png"
            width="72"
            height="72"
            alt="The Francis Files logo"
            style={logoImg}
          />
          <Text style={eyebrow}>The Francis Files</Text>
          <Heading style={h1}>New guest account request</Heading>
        </Section>
        <Text style={body}>
          <strong>{guestName || guestEmail}</strong> requested view-only access to the archive.
        </Text>
        <Text style={meta}>Email: {guestEmail}</Text>
        {requestedAt ? <Text style={meta}>Requested: {requestedAt}</Text> : null}
        <Text style={body}>
          The account stays pending and cannot see any archive data until you approve it.
        </Text>
        {approveUrl ? (
          <Section style={{ marginTop: '20px' }}>
            <Button href={approveUrl} style={button}>
              Review pending accounts
            </Button>
          </Section>
        ) : null}
      </Container>
    </Body>
  </Html>
)

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '28px 24px',
  maxWidth: '560px',
}
const logoImg: React.CSSProperties = { margin: '0 auto 12px', borderRadius: '50%' }
const eyebrow: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '0 0 6px',
}
const h1: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 16px',
}
const body: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#1f2937',
  margin: '0 0 12px',
}
const meta: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '20px',
  color: '#4b5563',
  margin: '0 0 4px',
}
const button: React.CSSProperties = {
  backgroundColor: '#111827',
  color: '#ffffff',
  fontSize: '14px',
  padding: '10px 18px',
  borderRadius: '4px',
  textDecoration: 'none',
}

export const template: TemplateEntry = {
  component: GuestRequestEmail,
  subject: (data) => `Guest account request: ${data['guestEmail'] ?? 'new user'}`,
  displayName: 'Guest account request',
  previewData: {
    guestEmail: 'guest@example.com',
    requestedAt: 'August 30, 2026',
    approveUrl: 'https://fharchive.com/admin/users',
  },
}

export default GuestRequestEmail
