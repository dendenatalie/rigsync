'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DamageReport, DamageSeverity, InventoryItem, Quote, Customer } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, AlertTriangle, Wrench, Package } from 'lucide-react';
import Link from 'next/link';

const SEVERITY_OPTIONS = [
  { value: 'minor',      label: 'Minor (cosmetic)' },
  { value: 'moderate',   label: 'Moderate (functional)' },
  { value: 'severe',     label: 'Severe (needs major repair)' },
  { value: 'total_loss', label: 'Total Loss' },
];

const SEVERITY_COLORS: Record<DamageSeverity, string> = {
  minor:      'bg-yellow-100 text-yellow-700',
  moderate:   'bg-orange-100 text-orange-700',
  severe:     'bg-red-100 text-red-700',
  total_loss: 'bg-red-900 text-white',
};

export default function DamagePage() {
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [items, setItems] = useState<Pick<InventoryItem, 'id' | 'name' | 'category'>[]>([]);
  const [quotes, setQuotes] = useState<Pick<Quote, 'id' | 'quote_number' | 'customer_id'>[]>([]);
  const [customers, setCustomers] = useState<Pick<Customer, 'id' | 'first_name' | 'last_name' | 'company_name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [form, setForm] = useState({
    item_id: '', quote_id: '', customer_id: '',
    severity: 'minor' as DamageSeverity,
    description: '', repair_cost: '',
    charged_amount: '', is_charged: false,
    reported_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  async function load() {
    const supabase = createClient();
    const [rptRes, itemRes, quoteRes, custRes] = await Promise.all([
      supabase.from('damage_reports')
        .select('*, inventory_items(name, category), customers(first_name, last_name, company_name), quotes(quote_number)')
        .order('reported_date', { ascending: false }),
      supabase.from('inventory_items').select('id, name, category').not('status', 'eq', 'retired').order('name'),
      supabase.from('quotes').select('id, quote_number, customer_id').order('quote_number', { ascending: false }).limit(100),
      supabase.from('customers').select('id, first_name, last_name, company_name').order('last_name'),
    ]);
    setReports(rptRes.data ?? []);
    setItems(itemRes.data ?? []);
    setQuotes(quoteRes.data ?? []);
    setCustomers(custRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit() {
    if (!form.item_id || !form.description) { return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('damage_reports').insert({
      item_id: form.item_id,
      quote_id: form.quote_id || null,
      customer_id: form.customer_id || null,
      severity: form.severity,
      description: form.description,
      repair_cost: form.repair_cost ? parseFloat(form.repair_cost) : null,
      charged_amount: parseFloat(form.charged_amount) || 0,
      is_charged: form.is_charged,
      reported_date: form.reported_date,
      notes: form.notes || null,
    });

    if (!error) {
      // Update item status if severe / total loss
      if (form.severity === 'total_loss') {
        await supabase.from('inventory_items').update({ status: 'lost' }).eq('id', form.item_id);
      } else if (form.severity === 'severe' || form.severity === 'moderate') {
        await supabase.from('inventory_items').update({ status: 'damaged' }).eq('id', form.item_id);
      }

      // Create financial transaction if charged
      if (form.is_charged && form.charged_amount && form.customer_id) {
        await supabase.from('financial_transactions').insert({
          quote_id: form.quote_id || null,
          customer_id: form.customer_id,
          type: 'damage_charge',
          amount: parseFloat(form.charged_amount),
          description: `Damage charge: ${form.description}`,
          transaction_date: form.reported_date,
        });
      }
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  const filtered = filter ? reports.filter(r => r.severity === filter) : reports;


  const totalRepairCosts = reports.reduce((s, r) => s + (r.repair_cost ?? 0), 0);
  const totalCharged = reports.reduce((s, r) => s + r.charged_amount, 0);
  const unchargedLoss = reports
    .filter(r => r.severity === 'total_loss' && !r.is_charged)
    .reduce((s, r) => s + (r.repair_cost ?? 0), 0);

  const itemOptions = [
    { value: '', label: '— Select Item —' },
    ...items.map(i => ({ value: i.id, label: i.name })),
  ];
  const quoteOptions = [
    { value: '', label: '— None —' },
    ...quotes.map(q => ({ value: q.id, label: q.quote_number })),
  ];
  const custOptions = [
    { value: '', label: '— None —' },
    ...customers.map(c => ({
      value: c.id,
      label: c.company_name ? `${c.company_name} (${c.first_name} ${c.last_name})` : `${c.first_name} ${c.last_name}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Damage & Loss Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track equipment damage, losses, and depreciation automatically over time
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> File Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-1">Total Repair Costs</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalRepairCosts)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-1">Recovered from Customers</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalCharged)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-1">Unrecovered Loss (Total Loss)</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(unchargedLoss)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'minor', 'moderate', 'severe', 'total_loss'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {/* Reports table */}
      <Card>
        <CardHeader><CardTitle>Damage Reports ({filtered.length})</CardTitle></CardHeader>
        {loading ? (
          <CardContent><div className="text-center py-8 text-gray-400">Loading…</div></CardContent>
        ) : filtered.length === 0 ? (
          <CardContent>
            <div className="text-center py-12">
              <Wrench size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">No damage reports. Your gear is in great shape!</p>
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Repair Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Charged</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const item = r.inventory_items as { name: string } | null;
                  const cust = r.customers as { first_name: string; last_name: string; company_name?: string } | null;
                  const quote = r.quotes as { quote_number: string } | null;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(r.reported_date)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/inventory/${r.item_id}`} className="text-indigo-600 hover:underline font-medium">
                          {item?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[r.severity]}`}>
                          {r.severity.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                        <p className="truncate">{r.description}</p>
                        {quote && (
                          <Link href={`/quotes/${r.quote_id}`} className="text-xs text-gray-400 hover:text-indigo-600">
                            {quote.quote_number}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {cust ? (cust.company_name ?? `${cust.first_name} ${cust.last_name}`) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {r.repair_cost ? formatCurrency(r.repair_cost) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">
                        {r.charged_amount > 0 ? formatCurrency(r.charged_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.repaired_date ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Repaired</span>
                        ) : r.severity === 'total_loss' ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Lost</span>
                        ) : (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Open</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Depreciation note */}
      <Card className="border-dashed bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Package size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Automatic Depreciation</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Equipment values are automatically tracked based on purchase date, purchase price, and your set
                depreciation rate. Run the Supabase <code className="bg-blue-100 px-1 rounded">update_equipment_values()</code> function
                periodically to update all current values. Depreciated values are visible on each inventory item&apos;s edit page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="File Damage / Loss Report" size="lg">
        <div className="space-y-4">
          <Select label="Item *" options={itemOptions} value={form.item_id} onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Related Quote" options={quoteOptions} value={form.quote_id} onChange={e => {
              const q = quotes.find(q => q.id === e.target.value);
              setForm(p => ({ ...p, quote_id: e.target.value, customer_id: q?.customer_id ?? p.customer_id }));
            }} />
            <Select label="Customer" options={custOptions} value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Severity *" options={SEVERITY_OPTIONS} value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value as DamageSeverity }))} />
            <Input label="Date" type="date" value={form.reported_date} onChange={e => setForm(p => ({ ...p, reported_date: e.target.value }))} />
          </div>
          <TextArea label="Description *" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the damage or loss…" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Estimated Repair Cost ($)" type="number" min="0" step="0.01" value={form.repair_cost} onChange={e => setForm(p => ({ ...p, repair_cost: e.target.value }))} />
            <Input label="Charged to Customer ($)" type="number" min="0" step="0.01" value={form.charged_amount} onChange={e => setForm(p => ({ ...p, charged_amount: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_charged"
              checked={form.is_charged}
              onChange={e => setForm(p => ({ ...p, is_charged: e.target.checked }))}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_charged" className="text-sm text-gray-700">
              Create damage charge transaction for customer
            </label>
          </div>
          <TextArea label="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleSubmit} loading={saving}>File Report</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
