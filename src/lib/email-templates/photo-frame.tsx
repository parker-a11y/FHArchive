import * as React from 'react'
import { Img, Link, Section, Text } from '@react-email/components'
import type { InlinePhoto } from '@/lib/inline-photos'

/** Email version of the framed photo: cream mat, gold rule, italic title. */
export function EmailPhotoFrame({ photo }: { photo: InlinePhoto }) {
  const img = (
    <Img
      src={photo.url}
      alt={photo.caption || (photo.identifier ? `${photo.identifier} archive photo` : 'Photo')}
      style={frameImg}
    />
  )
  return (
    <Section style={frameOuter}>
      <div style={frameMat}>{photo.href ? <Link href={photo.href}>{img}</Link> : img}</div>
      {photo.caption ? <Text style={frameTitle}>{photo.caption}</Text> : null}
      {photo.identifier ? (
        <Text style={frameId}>
          {photo.href ? (
            <Link href={photo.href} style={frameIdLink}>
              {photo.identifier}
            </Link>
          ) : (
            photo.identifier
          )}
        </Text>
      ) : null}
    </Section>
  )
}

export const frameOuter = { margin: '28px auto', maxWidth: '560px' }
export const frameMat = {
  backgroundColor: '#fbf7ee',
  border: '1px solid #d6c08a',
  padding: '12px',
  borderRadius: '4px',
  boxShadow: '0 6px 18px rgba(60,45,20,0.18)',
}
export const frameImg = {
  display: 'block',
  width: '100%',
  maxWidth: '536px',
  border: '1px solid #e9dfc6',
  borderRadius: '2px',
}
export const frameTitle = {
  margin: '12px 0 0',
  textAlign: 'center' as const,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontStyle: 'italic' as const,
  fontSize: '16px',
  lineHeight: '22px',
  color: '#3a2f1d',
}
export const frameId = {
  margin: '6px 0 0',
  textAlign: 'center' as const,
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: '11px',
  letterSpacing: '2.5px',
  textTransform: 'uppercase' as const,
  color: '#a08a3f',
}
export const frameIdLink = { color: '#8a6a1f', textDecoration: 'none', fontWeight: 'bold' as const }
