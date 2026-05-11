import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Provision the user's org membership after email confirmation
      const { data: { user } } = await supabase.auth.getUser();
      if (user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const admin = createAdminClient();

          // Check if this user already has an org membership
          const { data: existingMember } = await admin
            .from('organization_members')
            .select('org_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!existingMember) {
            // Check if they were invited to an existing org
            const invitedOrgId = user.user_metadata?.invited_org_id as string | undefined;

            if (invitedOrgId) {
              // Join the org they were invited to as a regular member
              await admin.from('organization_members').insert({
                org_id: invitedOrgId,
                user_id: user.id,
                role: 'member',
              });
            } else {
              // Self-signup: create a brand new org and make them owner
              const { data: org } = await admin
                .from('organizations')
                .insert({ name: 'My Company' })
                .select('id')
                .single();

              if (org) {
                await admin.from('organization_members').insert({
                  org_id: org.id,
                  user_id: user.id,
                  role: 'owner',
                });

                // Seed default app_settings for their new org
                await admin.from('app_settings').insert({
                  org_id: org.id,
                  company_name: 'My Company',
                  primary_color: '#4338CA',
                  secondary_color: '#6366F1',
                  invoice_footer: 'Thank you for your business!',
                  stripe_enabled: false,
                });
              }
            }
          }
        } catch (err) {
          // Org provisioning failed — log and continue. The user is still
          // authenticated; they'll see empty data until the issue is fixed.
          console.error('[auth/callback] org provisioning error:', err);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
