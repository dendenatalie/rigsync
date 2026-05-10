'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Quote, QuoteItem, Customer, DocumentStatus, STATUS_COLORS, STATUS_TRANSITIONS } from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';
import { ArrowLeft, Download, DollarSign, ChevronRight, AlertTriangle, Link2, Check } from 'lucide-react';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'check', reference: '', date: new Date().toISOString().split('T')[0] });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  useEffect(() => {
    createClient().from('app_settings').select('stripe_enabled').limit(1).single()
      .then(({ data }) => setStripeEnabled(data?.stripe_enabled ?? false));
  }, []);

  async function loadQuote() {
    const supabase = createClient();
    const { data } = await supabase
      .from('quotes')
      .select('*, customers(*), quote_items(*)')
      .eq('id', id)
      .single();
    setQuote(data as Quote);
    setLoading(false);
  }

  useEffect(() => { loadQuote(); }, [id]);

  async function transitionStatus(newStatus: DocumentStatus) {
    setTransitioning(true);
    const supabase = createClient();
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'sent') updates.sent_at = new Date().toISOString();
    if (newStatus === 'approved') updates.approved_at = new Date().toISOString();
    if (newStatus === 'invoiced') updates.invoiced_at = new Date().toISOString();
    if (newStatus === 'paid') updates.paid_at = new Date().toISOString();
    await supabase.from('quotes').update(updates).eq('id', id);
    await loadQuote();
    setTransitioning(false);
  }

  async function recordPayment() {
    if (!quote) return;
    const supabase = createClient();
    await supabase.from('financial_transactions').insert({
      quote_id: id,
      customer_id: (quote.customers as Customer)?.id,
      type: 'payment',
      amount: parseFloat(paymentForm.amount),
      description: `Payment for ${quote.quote_number}`,
      payment_method: paymentForm.method,
      reference: paymentForm.reference || null,
      transaction_date: paymentForm.date,
    });
    // Mark as paid if full payment
    if (parseFloat(paymentForm.amount) >= quote.total) {
      await transitionStatus('paid');
    }
    setPaymentModal(false);
  }

  async function generatePaymentLink() {
    setLinkLoading(true);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: id }),
    });
    const data = await res.json();
    if (data.url) {
      await navigator.clipboard.writeText(data.url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
    setLinkLoading(false);
  }

  async function downloadPdf() {
    if (!quote) return;
    setPdfLoading(true);
    const { generateInvoicePdf } = await import('@/lib/pdf/generateInvoicePdf');
    await generateInvoicePdf(quote);
    setPdfLoading(false);
  }

  if (loading) return <div className="text-gray-400 text-center py-20">Loading…</div>;
  if (!quote) return <div className="text-gray-400 text-center py-20">Quote not found.</div>;

  const cust = quote.customers as Customer | null;
  const items = (quote.quote_items as QuoteItem[]) ?? [];
  const transitions = STATUS_TRANSITIONS[quote.status] ?? [];

  const STATUS_LABELS: Partial<Record<DocumentStatus, string>> = {
    sent: 'Mark as Sent',
    approved: 'Mark Approved',
    invoiced: 'Convert to Invoice',
    paid: 'Mark as Paid',
    cancelled: 'Cancel',
    draft: 'Revert to Draft',
    overdue: 'Mark Overdue',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/quotes">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{quote.quote_number}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[quote.status]}`}>
            {quote.status}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadPdf} loading={pdfLoading}>
            <Download size={14} /> PDF
          </Button>
          {(quote.status === 'invoiced' || quote.status === 'overdue') && stripeEnabled && (
            <Button variant="outline" size="sm" onClick={generatePaymentLink} loading={linkLoading}>
              {linkCopied ? <><Check size={14} /> Link Copied!</> : <><Link2 size={14} /> Payment Link</>}
            </Button>
          )}
          {(quote.status === 'invoiced' || quote.status === 'overdue') && (
            <Button size="sm" onClick={() => setPaymentModal(true)}>
              <DollarSign size={14} /> Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Status workflow */}
      {transitions.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-indigo-700 font-medium">Move to:</span>
          {transitions.map(t => (
            <Button
              key={t}
              size="sm"
              variant={t === 'cancelled' ? 'danger' : 'primary'}
              onClick={() => transitionStatus(t)}
              loading={transitioning}
            >
              {STATUS_LABELS[t] ?? t} <ChevronRight size={14} />
            </Button>
          ))}
        </div>
      )}

      {/* Overdue warning */}
      {quote.due_date && quote.status !== 'paid' && quote.status !== 'cancelled' && new Date(quote.due_date) < new Date() && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-orange-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">Invoice is past due!</p>
            <p className="text-xs text-orange-600">Due {formatDate(quote.due_date)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {cust ? (
              <>
                {cust.company_name && <p className="font-semibold text-gray-900">{cust.company_name}</p>}
                <p className={cust.company_name ? 'text-sm text-gray-600' : 'font-semibold text-gray-900'}>
                  {cust.first_name} {cust.last_name}
                </p>
                {cust.email && <p className="text-sm text-gray-500">{cust.email}</p>}
                {cust.phone && <p className="text-sm text-gray-500">{cust.phone}</p>}
                <Link href={`/customers/${cust.id}`} className="text-xs text-indigo-600 hover:underline">View customer →</Link>
              </>
            ) : <p className="text-gray-400 text-sm">No customer</p>}
          </CardContent>
        </Card>

        {/* Event details */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Event Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs">Event</p><p className="font-medium">{quote.event_name ?? '—'}</p></div>
              <div><p className="text-gray-500 text-xs">Location</p><p className="font-medium">{quote.event_location ?? '—'}</p></div>
              <div><p className="text-gray-500 text-xs">Rental Start</p><p className="font-medium">{formatDate(quote.rental_start)}</p></div>
              <div><p className="text-gray-500 text-xs">Rental End</p><p className="font-medium">{formatDate(quote.rental_end)}</p></div>
              <div><p className="text-gray-500 text-xs">Duration</p><p className="font-medium">{quote.rental_days} days</p></div>
              <div><p className="text-gray-500 text-xs">Due Date</p><p className="font-medium">{quote.due_date ? formatDate(quote.due_date) : '—'}</p></div>
              {quote.valid_until && <div><p className="text-gray-500 text-xs">Valid Until</p><p className="font-medium">{formatDate(quote.valid_until)}</p></div>}
              {quote.paid_at && <div><p className="text-gray-500 text-xs">Paid</p><p className="font-medium text-green-700">{formatDateTime(quote.paid_at)}</p></div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line items table */}
      <Card>
        <CardHeader><CardTitle>Equipment & Services</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Daily Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.sort((a, b) => a.sort_order - b.sort_order).map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.daily_rate)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.days}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="max-w-xs ml-auto space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount ({quote.discount_pct}%)</span>
                <span>−{formatCurrency(quote.discount_amount)}</span>
              </div>
            )}
            {quote.labor_cost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Labor</span>
                <span>{formatCurrency(quote.labor_cost)}</span>
              </div>
            )}
            {quote.delivery_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Delivery</span>
                <span>{formatCurrency(quote.delivery_fee)}</span>
              </div>
            )}
            {quote.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({quote.tax_rate}%)</span>
                <span>{formatCurrency(quote.tax_amount)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
              <span className="text-gray-900">TOTAL</span>
              <span className="text-indigo-600">{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {(quote.notes || quote.internal_notes) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quote.notes && (
            <Card>
              <CardHeader><CardTitle>Customer Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p></CardContent>
            </Card>
          )}
          {quote.internal_notes && (
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-gray-500">Internal Notes (not on invoice)</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.internal_notes}</p></CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Payment modal */}
      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="Record Payment">
        <div className="space-y-4">
          <Input
            label="Amount ($)"
            type="number"
            min="0"
            step="0.01"
            value={paymentForm.amount}
            onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
            placeholder={formatCurrency(quote.total)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Payment Method</label>
            <select
              value={paymentForm.method}
              onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {['check', 'cash', 'card', 'bank_transfer', 'venmo', 'zelle', 'other'].map(m => (
                <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <Input
            label="Reference / Check #"
            value={paymentForm.reference}
            onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))}
            placeholder="Optional"
          />
          <Input
            label="Payment Date"
            type="date"
            value={paymentForm.date}
            onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setPaymentModal(false)}>Cancel</Button>
            <Button onClick={recordPayment}>Record Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
