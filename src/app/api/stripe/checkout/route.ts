import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local' }, { status: 503 });
  }

  const { quoteId } = await req.json();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Use service role — this endpoint is called by unauthenticated customers
  const admin = createAdminClient();

  const { data: quote, error } = await admin
    .from('quotes')
    .select('*, customers(*)')
    .eq('id', quoteId)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  // Fetch settings scoped to the org that owns this quote
  const { data: settings } = await admin
    .from('app_settings')
    .select('company_name')
    .eq('org_id', quote.org_id)
    .maybeSingle();

  const companyName = settings?.company_name ?? 'RigSync';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const cust = quote.customers as { email?: string } | null;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${quote.quote_number}`,
            description: quote.event_name
              ? `${companyName} — ${quote.event_name}`
              : `${companyName} — A/V Rental Services`,
          },
          unit_amount: Math.round(quote.total * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${appUrl}/pay/${quoteId}?success=1`,
    cancel_url: `${appUrl}/pay/${quoteId}?cancelled=1`,
    customer_email: cust?.email ?? undefined,
    metadata: { quote_id: quoteId, quote_number: quote.quote_number },
  });

  await admin.from('stripe_sessions').insert({
    quote_id: quoteId,
    org_id: quote.org_id,
    session_id: session.id,
    payment_url: session.url!,
    amount: quote.total,
    status: 'open',
  });

  return NextResponse.json({ url: session.url });
}
