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
        archiveName: 'The Francis Files',
        senderName: 'The Francis Files',
        recordTitle: 'Sample Record — Letter from Francis to Jacquelyn',
        recordNumber: 'FH0001',
        recordDescription:
          'This is a sample email from The Francis Files showing how a shared record looks. The link below opens a private, unlisted archive page.',
        shareUrl: 'https://fharchive.com',
        shareLabel: 'View this record',
      },
      idempotencyKey: `sample-${Date.now()}`,
    })
    return result
  })
