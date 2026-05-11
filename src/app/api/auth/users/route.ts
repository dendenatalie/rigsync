import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find the caller's org membership
  const { data: callerMember } = await admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!callerMember) {
    // Not yet assigned to an org (e.g. org provisioning is pending)
    return NextResponse.json({
      users: [{
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        invited_at: null,
        isAdmin: true,
      }],
    });
  }

  // Get all members of this org
  const { data: members, error: membersError } = await admin
    .from('organization_members')
    .select('user_id, role, created_at')
    .eq('org_id', callerMember.org_id);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const memberIds = (members ?? []).map(m => m.user_id);

  // Fetch auth details for those users
  const { data: authData, error: authError } = await admin.auth.admin.listUsers();
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const orgUsers = (authData.users ?? []).filter(u => memberIds.includes(u.id));

  const users = orgUsers.map(u => {
    const membership = (members ?? []).find(m => m.user_id === u.id);
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      invited_at: u.invited_at,
      isAdmin: membership?.role === 'owner',
    };
  });

  return NextResponse.json({ users });
}
