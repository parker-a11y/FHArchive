import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// Admin-only test email sender. Never call from public routes/loaders.
export const sendSampleEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ to: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
      .eq('role', 'admin')
      .maybeSingle()
    if (!role) throw new Error('Admin access required')

    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    const result = await sendTemplateEmail('archive-record', data.to, {
      templateData: {
        headerTitle: 'From The Francis Files',
        headerSubtitle: 'A sample shared record',
        message:
          'This is a sample email from The Francis Files showing how a shared record looks. Links open private, unlisted archive pages and can be revoked at any time.',
        senderName: 'The Francis Files',
        records: [
          {
            identifier: 'FH0001',
            title: 'Letter from Francis to Jacquelyn',
            date: '1944-09-23',
            details: ['Personal letter', 'World War II'],
            summary:
              'A wartime letter home describing life at sea aboard the USS Doyle C. Barnes.',
            url: 'https://fharchive.com',
          },
        ],
      },
      idempotencyKey: `sample-${Date.now()}`,
    })
    return result
  })
