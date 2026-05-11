import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function getCallerMembership(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = await getCallerMembership(user.id);
  if (!member) {
    return NextResponse.json({ error: 'You are not a member of any organization.' }, { status: 403 });
  }
  if (member.role !== 'owner') {
    return NextResponse.json({ error: 'Only the account owner can invite team members.' }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/api/auth/callback?next=/dashboard`,
    data: { invited_org_id: member.org_id },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, user: data.user });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerMember = await getCallerMembership(user.id);
  if (!callerMember || callerMember.role !== 'owner') {
    return NextResponse.json({ error: 'Only the account owner can remove team members.' }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the target belongs to the caller's org
  const { data: targetMember } = await admin
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', callerMember.org_id)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: 'User is not a member of your organization.' }, { status: 400 });
  }
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'The account owner cannot be removed.' }, { status: 400 });
  }

  // Remove org membership then delete the auth account
  await admin
    .from('organization_members')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', callerMember.org_id);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
