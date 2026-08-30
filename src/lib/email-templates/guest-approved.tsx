import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface GuestApprovedEmailProps {
  guestName?: string | null
  archiveUrl?: string
}

const GuestApprovedEmail = ({
  guestName,
  archiveUrl = 'https://fharchive.com',
}: GuestApprovedEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your access to The Francis Files has been approved</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <Text style={eyebrow}>The Francis Files</Text>
          <Heading style={h1}>Your account has been approved</Heading>
        </Section>
        <Text style={body}>
          {guestName ? `Hi ${guestName}, your` : 'Your'} request for view-only access to The
          Francis Files has been approved.
        </Text>
        <Text style={body}>
          Sign in with the email address you used to request access to browse the archive.
        </Text>
        <Section style={{ marginTop: '20px' }}>
          <Button href={archiveUrl} style={button}>
            Open The Francis Files
          </Button>
        </Section>
        <Text style={meta}>{archiveUrl}</Text>
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
  margin: '12px 0 0',
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
  component: GuestApprovedEmail,
  subject: 'Your access to The Francis Files has been approved',
  displayName: 'Guest account approved',
  previewData: {
    guestName: 'Jane',
    archiveUrl: 'https://fharchive.com',
  },
}

export default GuestApprovedEmail
