import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/** Returns the admin (oldest) user id from the full user list */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAdminId(adminClient: any): Promise<string | null> {
  const { data } = await adminClient.auth.admin.listUsers();
  if (!data?.users?.length) return null;
  const sorted = [...data.users].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted[0].id;
}

export async function POST(req: NextRequest) {
  // Verify the requesting user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Service role key not configured. Add SUPABASE_SERVICE_ROLE_KEY to your environment.' },
      { status: 503 }
    );
  }

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Only the admin (oldest account) can invite new users
  const adminId = await getAdminId(admin);
  if (user.id !== adminId) {
    return NextResponse.json({ error: 'Only the account owner can invite team members.' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/api/auth/callback?next=/dashboard`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, user: data.user });
}

export async function DELETE(req: NextRequest) {
  // Verify the requesting user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Service role key not configured.' },
      { status: 503 }
    );
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Prevent deleting yourself
  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Only the admin (oldest account) can remove users
  const adminId = await getAdminId(admin);
  if (user.id !== adminId) {
    return NextResponse.json({ error: 'Only the account owner can remove team members.' }, { status: 403 });
  }

  // The admin account itself can never be deleted
  if (userId === adminId) {
    return NextResponse.json({ error: 'The account owner cannot be removed.' }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
