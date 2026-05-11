import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Idempotent org provisioning — safe to call on every dashboard load.
 * Creates an org + owner membership if the user doesn't have one yet.
 * Handles the case where email confirmation is disabled and the auth
 * callback was never triggered.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 });
  }

  const admin = createAdminClient();

  // Check if org already exists — if so, nothing to do
  const { data: existing } = await admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, orgId: existing.org_id, created: false });
  }

  // Check if they were invited to an existing org (metadata set by invite API)
  const invitedOrgId = user.user_metadata?.invited_org_id as string | undefined;

  if (invitedOrgId) {
    await admin.from('organization_members').insert({
      org_id: invitedOrgId,
      user_id: user.id,
      role: 'member',
    });
    return NextResponse.json({ ok: true, orgId: invitedOrgId, created: true });
  }

  // Self-signup: create a fresh org and make them owner
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: 'My Company' })
    .select('id')
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }

  await admin.from('organization_members').insert({
    org_id: org.id,
    user_id: user.id,
    role: 'owner',
  });

  // Seed default app_settings for the new org
  await admin.from('app_settings').insert({
    org_id: org.id,
    company_name: 'My Company',
    primary_color: '#4338CA',
    secondary_color: '#6366F1',
    invoice_footer: 'Thank you for your business!',
    stripe_enabled: false,
  });

  return NextResponse.json({ ok: true, orgId: org.id, created: true });
}
