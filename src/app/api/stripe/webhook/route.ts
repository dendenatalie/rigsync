import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quote_id;

    if (quoteId) {
      // Service role bypasses RLS — required since webhook has no user session
      const admin = createAdminClient();

      await admin
        .from('stripe_sessions')
        .update({ status: 'paid', completed_at: new Date().toISOString() })
        .eq('session_id', session.id);

      const { data: quote } = await admin
        .from('quotes')
        .select('*, customers(id)')
        .eq('id', quoteId)
        .single();

      if (quote) {
        const customerId = (quote.customers as { id: string } | null)?.id;
        const amountPaid = (session.amount_total ?? 0) / 100;

        // Include org_id explicitly since webhook has no auth session
        // (trigger's get_user_org_id() would return NULL without a session)
        await admin.from('financial_transactions').insert({
          quote_id: quoteId,
          org_id: quote.org_id,
          customer_id: customerId ?? null,
          type: 'payment',
          amount: amountPaid,
          description: `Stripe payment for ${quote.quote_number}`,
          payment_method: 'card',
          reference: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          transaction_date: new Date().toISOString().split('T')[0],
        });

        await admin
          .from('quotes')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', quoteId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
