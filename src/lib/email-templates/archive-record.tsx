import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface EmailRecord {
  identifier?: string
  title?: string | null
  date?: string | null
  details?: string[]
  summary?: string | null
  transcription?: string | null
  url?: string | null
  images?: string[]
  /** Marked as a Francis File Find (FFF) — shows the badge on the card. */
  fff?: boolean
}

export interface ArchiveRecordEmailProps {
  headerTitle?: string
  headerSubtitle?: string
  message?: string
  records?: EmailRecord[]
  senderName?: string
  /** FH / DS number -> public share URL, so recipients can open cited records. */
  shareLinks?: Record<string, string>
}

/** Renders **bold**, *italic*, and FH/DS record numbers as clickable links. */
function renderInline(text: string, shareLinks: Record<string, string>) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|FH-?\d{3,}|DS-?\d{3,})/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part))
      return <strong key={i}>{renderInline(part.slice(2, -2), shareLinks)}</strong>
    if (/^\*[^*]+\*$/.test(part))
      return <em key={i}>{renderInline(part.slice(1, -1), shareLinks)}</em>
    if (/^(FH|DS)-?\d{3,}$/.test(part)) {
      const url = shareLinks[part.toUpperCase()] ?? shareLinks[part.toUpperCase().replace(/-/g, '')]
      if (url)
        return (
          <Link key={i} href={url} style={recordLink}>
            {part}
          </Link>
        )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

/** Message paragraphs with light markdown: headings, bullets, hr, bold/italic, record links. */
function MessageBody({ message, shareLinks }: { message: string; shareLinks: Record<string, string> }) {
  const blocks = message.trim().split(/\n{2,}/)
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim())
        if (!lines.length) return null

        if (lines.every((l) => /^\s*-{3,}\s*$/.test(l))) return <Hr key={i} style={hr} />

        if (/^#{1,4}\s/.test(lines[0]!) && lines.length === 1)
          return (
            <Text key={i} style={msgHeading}>
              {renderInline(lines[0]!.replace(/^#{1,4}\s*/, ''), shareLinks)}
            </Text>
          )

        if (lines.every((l) => /^\s*[-*]\s+/.test(l)))
          return (
            <Text key={i} style={body}>
              {lines.map((l, j) => (
                <React.Fragment key={j}>
                  {j > 0 ? <br /> : null}• {renderInline(l.replace(/^\s*[-*]\s+/, ''), shareLinks)}
                </React.Fragment>
              ))}
            </Text>
          )

        return (
          <Text key={i} style={body}>
            {renderInline(lines.join(' '), shareLinks)}
          </Text>
        )
      })}
    </>
  )
}

const ArchiveRecordEmail = ({
  headerTitle = 'From The Francis Files',
  headerSubtitle,
  message,
  records = [],
  senderName,
}: ArchiveRecordEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{headerSubtitle || headerTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img
            src="https://fharchive.com/__l5e/assets-v1/f9b37994-85ba-4cde-b07a-a2698f053834/email-logo.png"
            width="72"
            height="72"
            alt="The Francis Files logo"
            style={logoImg}
          />
          <Text style={eyebrow}>The Francis Files</Text>
          <Heading style={h1}>{headerTitle}</Heading>
          {headerSubtitle ? <Text style={subtitle}>{headerSubtitle}</Text> : null}
        </Section>

        {message
          ? message
              .split(/\n{2,}/)
              .map((para, i) => (
                <Text key={i} style={body}>
                  {para}
                </Text>
              ))
          : null}

        {records.map((r, i) => (
          <Section key={i} style={card}>
            {r.fff ? (
              <Section style={fffRow}>
                <Img
                  src="https://fharchive.com/fff-badge.png"
                  width="22"
                  height="22"
                  alt="FFF"
                  style={fffBadgeImg}
                />
                <Text style={fffLabel}>FFF — Francis File Find</Text>
              </Section>
            ) : null}
            <Text style={idLine}>{r.identifier}</Text>
            {r.title ? <Heading as="h2" style={h2}>{r.title}</Heading> : null}
            {r.date ? <Text style={meta}>{r.date}</Text> : null}
            {(r.details ?? []).length > 0 ? (
              <Text style={meta}>{(r.details ?? []).join(' · ')}</Text>
            ) : null}
            {r.summary ? <Text style={body}>{r.summary}</Text> : null}
            {(r.images ?? []).slice(0, 4).map((src, j) => (
              <Img key={j} src={src} alt={`${r.identifier ?? 'Archive item'} scan`} style={image} />
            ))}
            {r.transcription ? (
              <>
                <Text style={label}>Transcription</Text>
                <Text style={transcript}>{r.transcription}</Text>
              </>
            ) : null}
            {r.url ? (
              <Button href={r.url} style={button}>
                View in the archive
              </Button>
            ) : null}
          </Section>
        ))}

        <Hr style={hr} />
        <Text style={footer}>
          {senderName && senderName !== 'The Francis Files'
            ? `Sent by ${senderName} from The Francis Files.`
            : 'Sent by The Francis Files.'}
        </Text>
        {records[0]?.url ? (
          <Text style={footer}>
            <Link href={records[0].url} style={{ color: '#7a6a3f' }}>
              {records[0].url}
            </Link>
          </Text>
        ) : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ArchiveRecordEmail,
  subject: (data: Record<string, any>) =>
    (data['subject'] as string) || 'From The Francis Files',
  displayName: 'Archive record share',
  previewData: {
    headerTitle: 'A letter from Francis, March 1944',
    headerSubtitle: 'From The Francis Files',
    message: 'Thought you would enjoy this one — his description of Borneo is remarkable.',
    senderName: 'The Francis Files',
    records: [
      {
        identifier: 'FH0002',
        title: 'Letter to Jacqueline Harrington',
        date: '12 March 1944',
        details: ['Correspondence · Personal letter', 'Francis A. Harrington'],
        summary: 'A four-page letter describing life aboard ship and the fruit markets ashore.',
        url: 'https://fharchive.com/s/example',
      },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '24px 24px 40px', maxWidth: '640px' }
const header = { borderBottom: '2px solid #cbd5c0', paddingBottom: '16px', marginBottom: '20px' }
const fffRow = { margin: '0 0 6px' }
const fffBadgeImg = { display: 'inline-block', verticalAlign: 'middle' }
const fffLabel = {
  display: 'inline-block',
  verticalAlign: 'middle',
  margin: '0 0 0 8px',
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#b4832c',
  fontWeight: 700,
}

const logoImg = { margin: '0 auto 12px', borderRadius: '50%' }
const eyebrow = {
  margin: '0 0 6px',
  fontSize: '11px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#8a8f7d',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
const h1 = { margin: '0', fontSize: '24px', lineHeight: '32px', color: '#2f3327' }
const subtitle = { margin: '8px 0 0', fontSize: '14px', color: '#6b7060' }
const body = { fontSize: '15px', lineHeight: '24px', color: '#33372b' }
const card = {
  backgroundColor: '#faf7f0',
  border: '1px solid #e4dcc7',
  borderRadius: '8px',
  padding: '18px 20px',
  margin: '20px 0',
}
const idLine = {
  margin: '0 0 4px',
  fontSize: '12px',
  letterSpacing: '1.5px',
  color: '#a08a3f',
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontWeight: 'bold' as const,
}
const h2 = { margin: '0 0 6px', fontSize: '18px', lineHeight: '26px', color: '#2f3327' }
const meta = { margin: '0 0 6px', fontSize: '13px', color: '#6b7060' }
const label = {
  margin: '16px 0 4px',
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#8a8f7d',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
const transcript = {
  fontSize: '14px',
  lineHeight: '23px',
  color: '#33372b',
  whiteSpace: 'pre-wrap' as const,
}
const image = {
  width: '100%',
  maxWidth: '560px',
  borderRadius: '6px',
  border: '1px solid #e4dcc7',
  margin: '12px 0',
}
const button = {
  backgroundColor: '#5d6b4a',
  color: '#ffffff',
  borderRadius: '6px',
  padding: '10px 18px',
  fontSize: '14px',
  fontFamily: 'Helvetica, Arial, sans-serif',
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '12px',
}
const hr = { borderColor: '#e4dcc7', margin: '28px 0 14px' }
const footer = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#8a8f7d',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
