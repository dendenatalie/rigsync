'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle, XCircle, CreditCard, Loader2 } from 'lucide-react';

interface Settings {
  company_name: string;
  company_tagline: string;
  company_logo_url: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  primary_color: string;
  invoice_footer: string;
  stripe_enabled: boolean;
}

interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  event_name: string | null;
  rental_start: string;
  rental_end: string;
  rental_days: number;
  subtotal: number;
  discount_amount: number;
  discount_pct: number;
  labor_cost: number;
  delivery_fee: number;
  tax_amount: number;
  tax_rate: number;
  total: number;
  due_date: string | null;
  notes: string | null;
  payment_terms_text: string | null;
  project_terms_text: string | null;
  customers: {
    first_name: string;
    last_name: string;
    company_name: string | null;
    email: string | null;
  } | null;
  quote_items: {
    id: string;
    description: string;
    quantity: number;
    daily_rate: number;
    days: number;
    line_total: number;
    sort_order: number;
  }[];
}

function PayPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === '1';
  const cancelled = searchParams.get('cancelled') === '1';

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/pay/${id}`);
      if (res.ok) {
        const { quote: q, settings: s } = await res.json();
        setQuote(q as QuoteData);
        setSettings(s as Settings);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handlePay() {
    setPaying(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Failed to create payment session');
        setPaying(false);
      }
    } catch {
      setError('Network error — please try again');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800">Invoice not found</h1>
          <p className="text-gray-500 mt-1">This payment link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const color = settings?.primary_color ?? '#4338CA';
  const cust = quote.customers;
  const items = [...(quote.quote_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const isPaid = quote.status === 'paid';

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success / cancelled banners */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={22} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Payment successful — thank you!</p>
              <p className="text-sm text-green-600">Your payment has been received and your invoice is marked as paid.</p>
            </div>
          </div>
        )}
        {cancelled && !success && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle size={22} className="text-orange-500 flex-shrink-0" />
            <p className="text-sm text-orange-700">Payment was cancelled. You can try again below.</p>
          </div>
        )}

        {/* Invoice card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-8 text-white" style={{ backgroundColor: color }}>
            <div className="flex items-start justify-between">
              <div>
                {settings?.company_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.company_logo_url} alt="Logo" className="h-12 mb-3 object-contain" />
                ) : (
                  <h1 className="text-2xl font-bold">{settings?.company_name ?? 'RigSync'}</h1>
                )}
                {settings?.company_tagline && (
                  <p className="text-white/75 text-sm mt-0.5">{settings.company_tagline}</p>
                )}
                <div className="mt-3 space-y-0.5 text-white/80 text-sm">
                  {settings?.company_phone && <p>{settings.company_phone}</p>}
                  {settings?.company_email && <p>{settings.company_email}</p>}
                  {settings?.company_website && <p>{settings.company_website}</p>}
                </div>
              </div>
              <div className="text-right text-white/90">
                <p className="text-2xl font-bold">INVOICE</p>
                <p className="font-mono mt-1">{quote.quote_number}</p>
                {quote.due_date && <p className="text-sm mt-1">Due {formatDate(quote.due_date)}</p>}
                {isPaid && (
                  <span className="inline-block mt-2 bg-green-400/30 text-green-100 text-xs font-bold px-3 py-1 rounded-full">
                    PAID
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* Bill to + event */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Bill To</p>
                {cust?.company_name && <p className="font-bold text-gray-900">{cust.company_name}</p>}
                <p className={cust?.company_name ? 'text-gray-700' : 'font-bold text-gray-900'}>
                  {cust?.first_name} {cust?.last_name}
                </p>
                {cust?.email && <p className="text-gray-500 text-sm">{cust.email}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Event Details</p>
                {quote.event_name && <p className="font-bold text-gray-900">{quote.event_name}</p>}
                <p className="text-gray-600 text-sm">
                  {formatDate(quote.rental_start)} – {formatDate(quote.rental_end)}
                </p>
                <p className="text-gray-500 text-sm">{quote.rental_days} day{quote.rental_days !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Line items */}
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: `${color}15` }}>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700">Description</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700">Qty</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2.5 px-3 text-gray-800">{item.description}</td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right text-gray-800">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-100 pt-4 space-y-1.5 max-w-xs ml-auto">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({quote.discount_pct}%)</span>
                  <span>−{formatCurrency(quote.discount_amount)}</span>
                </div>
              )}
              {quote.labor_cost > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Labor</span><span>{formatCurrency(quote.labor_cost)}</span>
                </div>
              )}
              {quote.delivery_fee > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery</span><span>{formatCurrency(quote.delivery_fee)}</span>
                </div>
              )}
              {quote.tax_amount > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax ({quote.tax_rate}%)</span><span>{formatCurrency(quote.tax_amount)}</span>
                </div>
              )}
              <div
                className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200"
                style={{ color }}
              >
                <span>TOTAL</span><span>{formatCurrency(quote.total)}</span>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            {/* Payment terms + T&C + footer */}
            {(quote.payment_terms_text || quote.project_terms_text || settings?.invoice_footer) && (
              <div className="text-xs text-gray-400 space-y-2 border-t border-gray-100 pt-4">
                {quote.payment_terms_text && <p>{quote.payment_terms_text}</p>}
                {quote.project_terms_text && (
                  <div className="border-t border-gray-100 pt-2">
                    <p className="font-medium text-gray-500 mb-1">Terms & Conditions</p>
                    <p className="whitespace-pre-wrap">{quote.project_terms_text}</p>
                  </div>
                )}
                {settings?.invoice_footer && <p className="font-medium text-gray-500 border-t border-gray-100 pt-2">{settings.invoice_footer}</p>}
              </div>
            )}

            {/* Pay button */}
            {!isPaid && settings?.stripe_enabled && (
              <div className="pt-2">
                {error && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg p-3 flex items-center gap-2">
                    <XCircle size={16} /> {error}
                  </div>
                )}
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full py-3.5 rounded-xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: color }}
                >
                  {paying ? (
                    <><Loader2 size={18} className="animate-spin" /> Redirecting to payment…</>
                  ) : (
                    <><CreditCard size={18} /> Pay {formatCurrency(quote.total)} with Card</>
                  )}
                </button>
                <p className="text-center text-xs text-gray-400 mt-2">Secure payment powered by Stripe</p>
              </div>
            )}

            {isPaid && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle size={28} className="text-green-500 mx-auto mb-1" />
                <p className="font-semibold text-green-800">This invoice has been paid. Thank you!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense>
      <PayPageInner />
    </Suspense>
  );
}
