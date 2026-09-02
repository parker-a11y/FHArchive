import React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const LOGO =
  'https://fharchive.com/__l5e/assets-v1/f9b37994-85ba-4cde-b07a-a2698f053834/email-logo.png'

export interface WeeklyRecapEmailProps {
  weekRange?: string
  title?: string
  lede?: string | null
  /** Recap body as markdown-ish text — headings, bullets and paragraphs. */
  body?: string
  message?: string | null
  imageUrl?: string | null
  imageCaption?: string | null
  relatedIds?: string[]
  /** FH / DS number -> public share URL, so non-members can open records. */
  shareLinks?: Record<string, string>
  stats?: { label: string; value: string | number }[]
  recapUrl?: string | null
}

/** Splits the recap body into renderable blocks (heading / bullet / paragraph). */
function blocksOf(body: string) {
  return body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^#{1,4}\s/.test(block))
        return { kind: 'heading' as const, text: block.replace(/^#{1,4}\s+/, '') }
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l)))
        return { kind: 'bullets' as const, items: lines.map((l) => l.replace(/^[-*]\s+/, '')) }
      return { kind: 'paragraph' as const, text: lines.join(' ') }
    })
}

/** Strips markdown emphasis so the email reads cleanly in every client. */
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`/g, '')

/** Turns FH / DS numbers into links to their public share page when one exists. */
function linkify(text: string, shareLinks: Record<string, string>) {
  const clean = plain(text)
  if (!Object.keys(shareLinks).length) return clean
  return clean.split(/(FH-?\d{3,}|DS-?\d{3,})/g).map((part, i) => {
    const url = shareLinks[part.toUpperCase()]
    if (!url) return <React.Fragment key={i}>{part}</React.Fragment>
    return (
      <Link key={i} href={url} style={recordLink}>
        {part}
      </Link>
    )
  })
}

export const WeeklyRecapEmail = ({
  weekRange = '',
  title = 'Weekly Recap',
  lede = null,
  body = '',
  message = null,
  imageUrl = null,
  imageCaption = null,
  relatedIds = [],
  shareLinks = {},
  stats = [],
  recapUrl = null,
}: WeeklyRecapEmailProps) => (
  <Html>
    <Head />
    <Preview>{`${title}${weekRange ? ` — week of ${weekRange}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* ---- Masthead ---- */}
        <Section style={masthead}>
          <Img src={LOGO} width="56" height="56" alt="The Francis Files" style={logoImg} />
          <Text style={eyebrow}>The Francis Files</Text>
          <Text style={mastheadTitle}>WEEKLY RECAP</Text>
          <Text style={rule}>&nbsp;</Text>
          {weekRange ? <Text style={weekLine}>{weekRange}</Text> : null}
        </Section>

        {message ? <Text style={note}>{message}</Text> : null}

        <Text style={h1}>{plain(title)}</Text>
        {lede ? <Text style={lede_}>{plain(lede)}</Text> : null}

        {imageUrl ? (
          <Section>
            <Img src={imageUrl} alt={imageCaption || 'Archive scan'} style={image} />
            {imageCaption ? <Text style={caption}>{imageCaption}</Text> : null}
          </Section>
        ) : null}

        <Section>
          {blocksOf(body).map((block, i) => {
            if (block.kind === 'heading')
              return (
                <Text key={i} style={h2}>
                  {linkify(block.text, shareLinks)}
                </Text>
              )
            if (block.kind === 'bullets')
              return (
                <Section key={i}>
                  {block.items.map((item, j) => (
                    <Text key={j} style={bullet}>
                      • {linkify(item, shareLinks)}
                    </Text>
                  ))}
                </Section>
              )
            return (
              <Text key={i} style={para}>
                {linkify(block.text, shareLinks)}
              </Text>
            )
          })}
        </Section>

        {stats.length ? (
          <Section style={statsBar}>
            {stats.map((s) => (
              <Text key={s.label} style={statLine}>
                <span style={statValue}>{s.value}</span> {s.label}
              </Text>
            ))}
          </Section>
        ) : null}

        {relatedIds.length ? (
          <Section>
            <Text style={label}>Records in this recap</Text>
            <Text style={ids}>
              {relatedIds.map((id, i) => {
                const url = shareLinks[id.toUpperCase()]
                return (
                  <React.Fragment key={id}>
                    {i > 0 ? '  ·  ' : ''}
                    {url ? (
                      <Link href={url} style={recordLink}>
                        {id}
                      </Link>
                    ) : (
                      id
                    )}
                  </React.Fragment>
                )
              })}
            </Text>
          </Section>
        ) : null}

        {recapUrl ? (
          <Text style={para}>
            <Link href={recapUrl} style={linkStyle}>
              Open this recap in the archive
            </Link>
          </Text>
        ) : null}

        <Hr style={hr} />
        {Object.keys(shareLinks).length ? (
          <Text style={footer}>
            Record links above open a private, read-only view of that item — no account needed.
            Please don&rsquo;t forward them outside the family.
          </Text>
        ) : null}

        <Text style={footer}>
          The Francis Files — a private family archive. Weekly recaps are written from the week&rsquo;s
          catalog work.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyRecapEmail,
  subject: (data: Record<string, any>) =>
    (data['subject'] as string) ||
    `Francis Files Weekly Recap — ${(data['weekRange'] as string) || 'this week'}`,
  displayName: 'Weekly recap',
  previewData: {
    weekRange: 'August 24 – August 30, 2026',
    title: 'A quiet week of Borneo letters',
    lede: 'Nine new records, two verified transcriptions and a new thread about the Hotel Vendome.',
    body:
      'This week the archive added nine records, most of them wartime correspondence from the Pacific.\n\n## Threads\n\n- FH0042 confirms Francis was still aboard ship in March.\n- FH0048 adds a Miami forwarding address.\n\nThe strongest new find is a four-page letter describing the fruit markets ashore.',
    message: 'Here is this week&rsquo;s recap — Parker',
    relatedIds: ['FH0042', 'FH0048', 'DS0007'],
    stats: [
      { label: 'records added', value: 9 },
      { label: 'transcriptions', value: 2 },
    ],
    recapUrl: 'https://fharchive.com/recaps/2026-08-24',
  },
} satisfies TemplateEntry

const recordLink = { color: '#8a6a1f', textDecoration: 'underline', fontWeight: 'bold' as const }

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '24px 24px 40px', maxWidth: '640px' }
const masthead = {
  textAlign: 'center' as const,
  backgroundColor: '#faf7f0',
  border: '1px solid #e4dcc7',
  borderRadius: '10px',
  padding: '22px 20px 18px',
  marginBottom: '24px',
}
const logoImg = { margin: '0 auto 10px', borderRadius: '50%' }
const eyebrow = {
  margin: '0 0 6px',
  fontSize: '11px',
  letterSpacing: '3px',
  textTransform: 'uppercase' as const,
  color: '#8a8f7d',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
const mastheadTitle = {
  margin: '0',
  fontSize: '30px',
  lineHeight: '34px',
  letterSpacing: '6px',
  color: '#2f3327',
  fontWeight: 'bold' as const,
}
const rule = {
  margin: '12px auto',
  width: '64px',
  height: '2px',
  lineHeight: '2px',
  fontSize: '0',
  backgroundColor: '#b4832c',
}
const weekLine = {
  margin: '0',
  fontSize: '13px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#7a6a3f',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
const note = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#33372b',
  backgroundColor: '#f4f5f0',
  borderLeft: '3px solid #5d6b4a',
  padding: '10px 14px',
  margin: '0 0 20px',
}
const h1 = { margin: '0 0 6px', fontSize: '24px', lineHeight: '32px', color: '#2f3327' }
const lede_ = { margin: '0 0 18px', fontSize: '15px', lineHeight: '24px', color: '#6b7060' }
const h2 = { margin: '22px 0 8px', fontSize: '17px', lineHeight: '24px', color: '#2f3327' }
const para = { fontSize: '15px', lineHeight: '25px', color: '#33372b', margin: '0 0 14px' }
const bullet = { fontSize: '15px', lineHeight: '24px', color: '#33372b', margin: '0 0 6px 8px' }
const image = {
  width: '100%',
  maxWidth: '560px',
  borderRadius: '6px',
  border: '1px solid #e4dcc7',
  margin: '4px 0 6px',
}
const caption = { fontSize: '12px', color: '#8a8f7d', margin: '0 0 18px' }
const statsBar = {
  backgroundColor: '#faf7f0',
  border: '1px solid #e4dcc7',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '18px 0',
}
const statLine = {
  margin: '0 0 4px',
  fontSize: '13px',
  color: '#6b7060',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
const statValue = { color: '#2f3327', fontWeight: 'bold' as const, fontSize: '15px' }
const label = {
  margin: '18px 0 4px',
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#8a8f7d',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
const ids = {
  margin: '0',
  fontSize: '13px',
  letterSpacing: '1px',
  color: '#a08a3f',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
const linkStyle = { color: '#5d6b4a' }
const hr = { borderColor: '#e4dcc7', margin: '28px 0 14px' }
const footer = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#8a8f7d',
  fontFamily: 'Helvetica, Arial, sans-serif',
}
