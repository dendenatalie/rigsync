import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Public endpoint — returns quote + settings for the customer payment page.
 * Uses service-role to bypass RLS since the paying customer has no auth session.
 * The quote ID in the URL acts as the access token (UUID = 36 chars of entropy).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const admin = createAdminClient();

  const { data: quote, error } = await admin
    .from('quotes')
    .select('*, customers(first_name, last_name, company_name, email), quote_items(*)')
    .eq('id', id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  // Fetch settings scoped to the org that owns this quote
  const { data: settings } = await admin
    .from('app_settings')
    .select('*')
    .eq('org_id', quote.org_id)
    .maybeSingle();

  return NextResponse.json({ quote, settings });
}
