import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/send-sample-email')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get('authorization') || ''
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
        if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
        if (userError || !userData.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: role } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user.id)
          .eq('role', 'admin')
          .maybeSingle()
        if (!role) return Response.json({ error: 'Admin access required' }, { status: 403 })

        const body = await request.json().catch(() => ({}))
        const to = typeof body?.to === 'string' ? body.to : null
        if (!to || !to.includes('@')) {
          return Response.json({ error: 'Valid "to" address required' }, { status: 400 })
        }

        const template = body?.template === 'guest-approved' ? 'guest-approved' : 'archive-record'
        const guestData = {
          guestName: typeof body?.guestName === 'string' ? body.guestName : 'Parker',
          archiveUrl: 'https://fharchive.com',
        }
        const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
        const result = await sendTemplateEmail(template, to, {
          templateData: template === 'guest-approved' ? guestData : {
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
        return Response.json(result)
      },
    },
  },
})
