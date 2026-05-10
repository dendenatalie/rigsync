import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

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
      const supabase = getSupabase();

      await supabase
        .from('stripe_sessions')
        .update({ status: 'paid', completed_at: new Date().toISOString() })
        .eq('session_id', session.id);

      const { data: quote } = await supabase
        .from('quotes')
        .select('*, customers(id)')
        .eq('id', quoteId)
        .single();

      if (quote) {
        const customerId = (quote.customers as { id: string } | null)?.id;
        const amountPaid = (session.amount_total ?? 0) / 100;

        await supabase.from('financial_transactions').insert({
          quote_id: quoteId,
          customer_id: customerId ?? null,
          type: 'payment',
          amount: amountPaid,
          description: `Stripe payment for ${quote.quote_number}`,
          payment_method: 'card',
          reference: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          transaction_date: new Date().toISOString().split('T')[0],
        });

        await supabase
          .from('quotes')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', quoteId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
