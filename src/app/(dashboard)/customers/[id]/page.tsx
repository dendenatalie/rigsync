'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Customer, Quote, FinancialTransaction, STATUS_COLORS } from '@/types';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import Link from 'next/link';
import { ArrowLeft, Edit, Save, FileText, DollarSign } from 'lucide-react';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [custRes, quotesRes, txRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('quotes').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
        supabase.from('financial_transactions').select('*').eq('customer_id', id).order('transaction_date', { ascending: false }).limit(20),
      ]);
      const c = custRes.data as Customer;
      setCustomer(c);
      setForm(c);
      setQuotes(quotesRes.data ?? []);
      setTransactions(txRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('customers').update(form).eq('id', id);
    setSaving(false);
    setEditing(false);
    const { data } = await supabase.from('customers').select('*').eq('id', id).single();
    setCustomer(data);
  }

  if (loading) return <div className="text-gray-400 text-center py-20">Loading…</div>;
  if (!customer) return <div className="text-gray-400 text-center py-20">Customer not found.</div>;

  const totalRental = quotes.filter(q => q.status !== 'cancelled').reduce((s, q) => s + q.total, 0);
  const totalPaid = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/customers"><Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
            {getInitials(customer.first_name, customer.last_name)}
          </div>
          <div>
            {customer.company_name && <p className="text-xs text-gray-500">{customer.company_name}</p>}
            <h1 className="text-xl font-bold text-gray-900">{customer.first_name} {customer.last_name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/quotes/new?customer=${id}`}>
            <Button variant="outline" size="sm"><FileText size={14} /> New Quote</Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
            <Edit size={14} /> {editing ? 'Cancel Edit' : 'Edit'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-1">Total Billed</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalRental)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className={`p-5 ${customer.outstanding_balance > 0 ? 'bg-orange-50 border-orange-200' : ''}`}>
          <p className="text-xs text-gray-500 mb-1">Outstanding</p>
          <p className={`text-xl font-bold ${customer.outstanding_balance > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {formatCurrency(customer.outstanding_balance)}
          </p>
        </Card>
      </div>

      {/* Edit form */}
      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit Customer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Company Name" value={form.company_name ?? ''} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" value={form.first_name ?? ''} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} required />
              <Input label="Last Name" value={form.last_name ?? ''} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" value={form.email ?? ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" value={form.phone ?? ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Address Line 1" value={form.address_line1 ?? ''} onChange={e => setForm(p => ({ ...p, address_line1: e.target.value }))} />
              <Input label="Address Line 2" value={form.address_line2 ?? ''} onChange={e => setForm(p => ({ ...p, address_line2: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="City" value={form.city ?? ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              <Input label="State" value={form.state ?? ''} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
              <Input label="ZIP" value={form.zip ?? ''} onChange={e => setForm(p => ({ ...p, zip: e.target.value }))} />
            </div>
            <TextArea label="Notes" value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={save} loading={saving}><Save size={14} /> Save</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><p className="text-gray-400 text-xs">Email</p><p className="text-gray-900">{customer.email}</p></div>
              <div><p className="text-gray-400 text-xs">Phone</p><p className="text-gray-900">{customer.phone ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs">Address</p>
                <p className="text-gray-900">
                  {[customer.address_line1, customer.address_line2, customer.city && `${customer.city}, ${customer.state ?? ''} ${customer.zip ?? ''}`].filter(Boolean).join('\n') || '—'}
                </p>
              </div>
              {customer.notes && (
                <div className="col-span-2"><p className="text-gray-400 text-xs">Notes</p><p className="text-gray-900 whitespace-pre-wrap">{customer.notes}</p></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rental history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rental History</CardTitle>
            <span className="text-xs text-gray-500">{quotes.length} quotes</span>
          </div>
        </CardHeader>
        {quotes.length === 0 ? (
          <CardContent><p className="text-gray-400 text-sm text-center py-4">No rentals yet.</p></CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quote #</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Event</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Dates</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotes.map(q => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/quotes/${q.id}`} className="font-mono text-indigo-600 hover:underline text-xs">{q.quote_number}</Link>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{q.event_name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(q.rental_start)} – {formatDate(q.rental_end)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status]}`}>{q.status}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(q.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Payment history */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Method</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 text-gray-600">{formatDate(t.transaction_date)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.type === 'payment' ? 'bg-green-100 text-green-700' : t.type === 'refund' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{t.description}</td>
                    <td className="px-4 py-2 text-gray-500 capitalize">{t.payment_method?.replace('_', ' ') ?? '—'}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${t.type === 'payment' ? 'text-green-700' : t.type === 'refund' ? 'text-red-600' : ''}`}>
                      {t.type === 'refund' ? '−' : ''}{formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
