'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InventoryItem, Kit, Customer } from '@/types';
import { formatCurrency, calculateMultidayDiscount, daysBetween, bestRate } from '@/lib/utils';
import { getBookedItemIds } from '@/lib/utils/availability';
import { ArrowLeft, Plus, Trash2, Search, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface LineItem {
  id: string;
  item_id?: string;
  kit_id?: string;
  description: string;
  quantity: number;
  daily_rate: number;
  weekly_rate?: number;
  days: number;
  line_total: number;
  type: 'item' | 'kit' | 'custom';
  available?: boolean;
}

export default function NewQuotePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [applyDiscount, setApplyDiscount] = useState(true);

  const [form, setForm] = useState({
    customer_id: '',
    event_name: '',
    event_location: '',
    rental_start: '',
    rental_end: '',
    labor_cost: '0',
    delivery_fee: '0',
    tax_rate: '0',
    notes: '',
    internal_notes: '',
    due_date: '',
    valid_until: '',
    payment_terms_text: '',
    project_terms_text: '',
  });
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<{ id: string; name: string; body: string; is_default: boolean }[]>([]);
  const [projectTermsOptions, setProjectTermsOptions] = useState<{ id: string; name: string; body: string; is_default: boolean }[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [custRes, itemRes, kitRes, ptRes, projRes] = await Promise.all([
        supabase.from('customers').select('*').order('last_name'),
        supabase.from('inventory_items').select('*').not('status', 'eq', 'retired').order('category').order('name'),
        supabase.from('kits').select('*, kit_items(item_id, quantity, inventory_items(name, daily_rate, weekly_rate))').order('name'),
        supabase.from('terms_templates').select('id, name, body, is_default').eq('type', 'payment_terms').order('sort_order'),
        supabase.from('terms_templates').select('id, name, body, is_default').eq('type', 'project_terms').order('sort_order'),
      ]);
      setCustomers(custRes.data ?? []);
      setAllItems(itemRes.data ?? []);
      setKits(kitRes.data ?? []);
      const pt = (ptRes.data ?? []) as { id: string; name: string; body: string; is_default: boolean }[];
      const proj = (projRes.data ?? []) as { id: string; name: string; body: string; is_default: boolean }[];
      setPaymentTermsOptions(pt);
      setProjectTermsOptions(proj);
      const defaultPt = pt.find(t => t.is_default);
      const defaultProj = proj.find(t => t.is_default);
      setForm(f => ({
        ...f,
        payment_terms_text: defaultPt?.body ?? '',
        project_terms_text: defaultProj?.body ?? '',
      }));
    }
    load();
  }, []);

  // Re-check availability when dates change
  useEffect(() => {
    async function checkAvailability() {
      if (!form.rental_start || !form.rental_end) return;
      const booked = await getBookedItemIds(form.rental_start, form.rental_end);
      setBookedIds(booked);
      // Update lines with availability status
      setLines(prev => prev.map(l => {
        if (l.type === 'item' && l.item_id) {
          return { ...l, available: !booked.has(l.item_id) };
        }
        return l;
      }));
    }
    checkAvailability();
  }, [form.rental_start, form.rental_end]);

  const rentalDays = form.rental_start && form.rental_end
    ? daysBetween(form.rental_start, form.rental_end)
    : 1;

  const discountPct = applyDiscount ? calculateMultidayDiscount(rentalDays) : 0;

  const recalcLine = (l: LineItem): LineItem => {
    const days = l.days || rentalDays;
    const lineTotal = bestRate(l.daily_rate, l.weekly_rate, days) * l.quantity;
    return { ...l, days, line_total: lineTotal };
  };

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const discountAmount = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmount;
  const labor = parseFloat(form.labor_cost) || 0;
  const delivery = parseFloat(form.delivery_fee) || 0;
  const taxRate = parseFloat(form.tax_rate) || 0;
  const taxBase = afterDiscount + labor + delivery;
  const taxAmount = taxBase * (taxRate / 100);
  const total = taxBase + taxAmount;

  const addInventoryItem = (item: InventoryItem) => {
    const isAvailable = !bookedIds.has(item.id);
    const days = rentalDays;
    const lineTotal = bestRate(item.daily_rate, item.weekly_rate, days);
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      item_id: item.id,
      description: item.name,
      quantity: 1,
      daily_rate: item.daily_rate,
      weekly_rate: item.weekly_rate || undefined,
      days,
      line_total: lineTotal,
      type: 'item',
      available: isAvailable,
    }]);
    setSearch('');
  };

  const addKit = (kit: Kit) => {
    const kitItems = kit.kit_items ?? [];
    const dailyRate = kit.daily_rate ?? kitItems.reduce((s, ki) => {
      const inv = ki.inventory_items as { daily_rate: number } | null;
      return s + (inv?.daily_rate ?? 0) * ki.quantity;
    }, 0);
    const weeklyRate = kit.weekly_rate ?? undefined;
    const days = rentalDays;
    const lineTotal = bestRate(dailyRate, weeklyRate, days);
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      kit_id: kit.id,
      description: kit.name,
      quantity: 1,
      daily_rate: dailyRate,
      weekly_rate: weeklyRate,
      days,
      line_total: lineTotal,
      type: 'kit',
      available: true,
    }]);
    setSearch('');
  };

  const addCustomLine = () => {
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      daily_rate: 0,
      days: rentalDays,
      line_total: 0,
      type: 'custom',
      available: true,
    }]);
  };

  const updateLine = (id: string, updates: Partial<LineItem>) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, ...updates };
      return recalcLine(updated);
    }));
  };

  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  // Search results: items + kits not already added
  const itemResults = allItems.filter(i =>
    search && i.name.toLowerCase().includes(search.toLowerCase()) &&
    !lines.some(l => l.item_id === i.id)
  ).slice(0, 5);

  const kitResults = kits.filter(k =>
    search && k.name.toLowerCase().includes(search.toLowerCase()) &&
    !lines.some(l => l.kit_id === k.id)
  ).slice(0, 3);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError('Please select a customer.'); return; }
    if (!form.rental_start || !form.rental_end) { setError('Please set rental dates.'); return; }
    if (lines.length === 0) { setError('Add at least one item.'); return; }
    if (lines.some(l => l.available === false)) { setError('Some items are not available for those dates. Remove or replace them.'); return; }

    setSaving(true);
    setError('');
    const supabase = createClient();

    const { data: quote, error: qErr } = await supabase.from('quotes').insert({
      customer_id: form.customer_id,
      event_name: form.event_name || null,
      event_location: form.event_location || null,
      rental_start: form.rental_start,
      rental_end: form.rental_end,
      subtotal,
      discount_pct: discountPct,
      discount_amount: discountAmount,
      labor_cost: labor,
      delivery_fee: delivery,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes: form.notes || null,
      internal_notes: form.internal_notes || null,
      due_date: form.due_date || null,
      valid_until: form.valid_until || null,
      payment_terms_text: form.payment_terms_text || null,
      project_terms_text: form.project_terms_text || null,
      status: 'draft',
    }).select().single();

    if (qErr || !quote) { setError(qErr?.message ?? 'Failed to create quote'); setSaving(false); return; }

    // Insert line items
    const { error: liErr } = await supabase.from('quote_items').insert(
      lines.map((l, idx) => ({
        quote_id: quote.id,
        item_id: l.item_id ?? null,
        kit_id: l.kit_id ?? null,
        description: l.description,
        quantity: l.quantity,
        daily_rate: l.daily_rate,
        weekly_rate: l.weekly_rate ?? null,
        days: l.days,
        line_total: l.line_total,
        sort_order: idx,
      }))
    );
    if (liErr) { setError(liErr.message); setSaving(false); return; }

    // Create rental bookings for individual items
    const bookings = lines
      .filter(l => l.item_id)
      .map(l => ({
        quote_id: quote.id,
        item_id: l.item_id!,
        rental_start: form.rental_start,
        rental_end: form.rental_end,
      }));

    if (bookings.length > 0) {
      await supabase.from('rental_bookings').insert(bookings);
    }

    router.push(`/quotes/${quote.id}`);
  }

  const custOptions = [
    { value: '', label: '— Select Customer —' },
    ...customers.map(c => ({
      value: c.id,
      label: c.company_name ? `${c.company_name} (${c.first_name} ${c.last_name})` : `${c.first_name} ${c.last_name}`,
    })),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/quotes">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle>Quote Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select label="Customer *" options={custOptions} value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Event Name" value={form.event_name} onChange={e => setForm(p => ({ ...p, event_name: e.target.value }))} placeholder="e.g., Corporate Gala 2026" />
              <Input label="Event Location" value={form.event_location} onChange={e => setForm(p => ({ ...p, event_location: e.target.value }))} placeholder="Venue name or address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Rental Start *" type="date" value={form.rental_start} onChange={e => setForm(p => ({ ...p, rental_start: e.target.value }))} required />
              <Input label="Rental End *" type="date" value={form.rental_end} onChange={e => setForm(p => ({ ...p, rental_end: e.target.value }))} required />
            </div>
            {form.rental_start && form.rental_end && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">
                  <strong>{rentalDays} day{rentalDays !== 1 ? 's' : ''}</strong> rental
                </span>
                {discountPct > 0 && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {discountPct}% multi-day discount applies
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Valid Until" type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
              <Input label="Invoice Due Date" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* Line items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Equipment & Services</CardTitle>
              <button
                type="button"
                onClick={addCustomLine}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Add custom line
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lines */}
            {lines.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-gray-500 uppercase">
                  <div className="col-span-4">Description</div>
                  <div className="col-span-1 text-center">Qty</div>
                  <div className="col-span-2 text-right">Daily Rate</div>
                  <div className="col-span-2 text-center">Days</div>
                  <div className="col-span-2 text-right">Line Total</div>
                  <div className="col-span-1"></div>
                </div>
                {lines.map(l => (
                  <div key={l.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${l.available === false ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="col-span-4 flex items-center gap-1.5">
                      {l.available === false ? (
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                      ) : l.type !== 'custom' ? (
                        <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      ) : null}
                      {l.type === 'custom' ? (
                        <input
                          type="text"
                          value={l.description}
                          onChange={e => updateLine(l.id, { description: e.target.value })}
                          placeholder="Description…"
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 truncate">{l.description}</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="1"
                        value={l.quantity}
                        onChange={e => updateLine(l.id, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-full text-sm text-center border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.daily_rate}
                        onChange={e => updateLine(l.id, { daily_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full text-sm text-right border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={l.days}
                        onChange={e => updateLine(l.id, { days: parseInt(e.target.value) || 1 })}
                        className="w-full text-sm text-center border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(l.line_total)}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button type="button" onClick={() => removeLine(l.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search to add items */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search inventory items or kits to add…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {search && (itemResults.length > 0 || kitResults.length > 0) && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {kitResults.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">Kits</div>
                    {kitResults.map(kit => {
                      const kitItems = kit.kit_items ?? [];
                      const dr = kit.daily_rate ?? kitItems.reduce((s, ki) => s + ((ki.inventory_items as { daily_rate: number } | null)?.daily_rate ?? 0) * ki.quantity, 0);
                      return (
                        <button key={kit.id} type="button" onClick={() => addKit(kit)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors border-b border-gray-50">
                          <Plus size={14} className="text-indigo-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{kit.name}</p>
                            <p className="text-xs text-gray-500">{kitItems.length} items · {formatCurrency(dr)}/day</p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
                {itemResults.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">Items</div>
                    {itemResults.map(item => {
                      const booked = bookedIds.has(item.id);
                      return (
                        <button key={item.id} type="button" onClick={() => addInventoryItem(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-gray-50 ${booked ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-indigo-50'}`}>
                          <Plus size={14} className={booked ? 'text-red-400 flex-shrink-0' : 'text-indigo-500 flex-shrink-0'} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.category} · {formatCurrency(item.daily_rate)}/day</p>
                          </div>
                          {booked && (
                            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <AlertCircle size={12} /> Booked
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals & extras */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Additional Charges</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Labor Cost ($)" type="number" min="0" step="0.01" value={form.labor_cost} onChange={e => setForm(p => ({ ...p, labor_cost: e.target.value }))} />
              <Input label="Delivery / Setup Fee ($)" type="number" min="0" step="0.01" value={form.delivery_fee} onChange={e => setForm(p => ({ ...p, delivery_fee: e.target.value }))} />
              <Input label="Tax Rate (%)" type="number" min="0" max="50" step="0.1" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="apply-discount"
                  checked={applyDiscount}
                  onChange={e => setApplyDiscount(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="apply-discount" className="text-sm text-gray-700">
                  Apply multi-day discount ({discountPct}% for {rentalDays} days)
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader><CardTitle>Quote Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({discountPct}%)</span>
                  <span>−{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {labor > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Labor</span>
                  <span>{formatCurrency(labor)}</span>
                </div>
              )}
              {delivery > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery</span>
                  <span>{formatCurrency(delivery)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-lg">
                <span className="text-gray-900">Total</span>
                <span className="text-indigo-600">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Notes & Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <TextArea label="Customer-Facing Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes visible on the quote/invoice…" />
            <TextArea label="Internal Notes" value={form.internal_notes} onChange={e => setForm(p => ({ ...p, internal_notes: e.target.value }))} placeholder="Internal use only — not shown to customer…" />

            {/* Payment Terms */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Payment Terms</label>
                {paymentTermsOptions.length > 0 && (
                  <select
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={paymentTermsOptions.find(t => t.body === form.payment_terms_text)?.id ?? ''}
                    onChange={e => {
                      const t = paymentTermsOptions.find(o => o.id === e.target.value);
                      setForm(p => ({ ...p, payment_terms_text: t?.body ?? '' }));
                    }}
                  >
                    <option value="">— None —</option>
                    {paymentTermsOptions.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <TextArea
                value={form.payment_terms_text}
                onChange={e => setForm(p => ({ ...p, payment_terms_text: e.target.value }))}
                placeholder="Select a template above or type custom payment terms…"
                rows={2}
              />
            </div>

            {/* Project Terms */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Project Terms & Conditions</label>
                {projectTermsOptions.length > 0 && (
                  <select
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={projectTermsOptions.find(t => t.body === form.project_terms_text)?.id ?? ''}
                    onChange={e => {
                      const t = projectTermsOptions.find(o => o.id === e.target.value);
                      setForm(p => ({ ...p, project_terms_text: t?.body ?? '' }));
                    }}
                  >
                    <option value="">— None —</option>
                    {projectTermsOptions.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <TextArea
                value={form.project_terms_text}
                onChange={e => setForm(p => ({ ...p, project_terms_text: e.target.value }))}
                placeholder="Select a template above or type custom terms…"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Link href="/quotes"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit" loading={saving}>Create Quote</Button>
        </div>
      </form>
    </div>
  );
}
