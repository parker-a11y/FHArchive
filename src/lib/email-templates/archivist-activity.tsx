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

export interface ArchivistActivityEmailProps {
  /** e.g. "August 31, 2026" */
  periodLabel?: string
  /** Plain-language lines, one per archivist. */
  lines?: string[]
  archiveUrl?: string
}

const ArchivistActivityEmail = ({
  periodLabel = 'the last 24 hours',
  lines = [],
  archiveUrl = 'https://fharchive.com',
}: ArchivistActivityEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Archivist activity for {periodLabel}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <Img
            src="https://fharchive.com/__l5e/assets-v1/51a85af2-9738-4ffc-9a78-c044e7fb5526/email-logo.png"
            width="72"
            height="72"
            alt="The Francis Files logo"
            style={logoImg}
          />
          <Text style={eyebrow}>The Francis Files</Text>
          <Heading style={h1}>Archivist activity — {periodLabel}</Heading>
        </Section>
        {lines.length ? (
          lines.map((line, i) => (
            <Text key={i} style={body}>
              • {line}
            </Text>
          ))
        ) : (
          <Text style={body}>No archivist changes were made in this period.</Text>
        )}
        <Section style={{ marginTop: '20px' }}>
          <Button href={archiveUrl} style={button}>
            Open The Francis Files
          </Button>
        </Section>
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
  margin: '0 0 8px',
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
  component: ArchivistActivityEmail,
  subject: (data: Record<string, any>) =>
    `Archivist activity — ${data['periodLabel'] ?? 'daily summary'}`,
  displayName: 'Daily archivist activity',
  previewData: {
    periodLabel: 'August 31, 2026',
    lines: [
      'Riley Harrington changed keywords and added people for FH0014, FH0021 (2 records).',
      'Sam Doe verified transcriptions for FH0007.',
    ],
    archiveUrl: 'https://fharchive.com',
  },
}

export default ArchivistActivityEmail
