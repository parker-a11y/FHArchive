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

export interface ArchivistGrantedEmailProps {
  guestName?: string | null
  archiveUrl?: string
}

const ArchivistGrantedEmail = ({
  guestName,
  archiveUrl = 'https://fharchive.com',
}: ArchivistGrantedEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You now have Archivist access to The Francis Files</Preview>
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
          <Heading style={h1}>You now have Archivist access</Heading>
        </Section>
        <Text style={body}>
          {guestName ? `Hi ${guestName}, your` : 'Your'} account has been upgraded from view-only
          guest to Archivist.
        </Text>
        <Text style={body}>
          As an Archivist you can transcribe scans with AI, correct and verify transcriptions, run
          AI analysis, edit record details, add keywords, people, places, organizations and events,
          and create or manage Digital Sources.
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
  component: ArchivistGrantedEmail,
  subject: 'You now have Archivist access to The Francis Files',
  displayName: 'Archivist access granted',
  previewData: {
    guestName: 'Jane',
    archiveUrl: 'https://fharchive.com',
  },
}

export default ArchivistGrantedEmail
