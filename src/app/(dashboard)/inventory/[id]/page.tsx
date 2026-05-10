'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CATEGORY_LABELS, ITEM_STATUS_COLORS, InventoryItem, DamageReport } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'Rented' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
  { value: 'retired', label: 'Retired' },
];

export default function EditInventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [damages, setDamages] = useState<DamageReport[]>([]);
  const [form, setForm] = useState({
    name: '', description: '', serial_number: '', category: 'audio',
    status: 'available', daily_rate: '', weekly_rate: '',
    replacement_value: '', purchase_date: '', purchase_price: '',
    depreciation_rate: '15', location: '', notes: '',
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [itemRes, dmgRes] = await Promise.all([
        supabase.from('inventory_items').select('*').eq('id', id).single(),
        supabase.from('damage_reports').select('*, quotes(quote_number)').eq('item_id', id).order('reported_date', { ascending: false }),
      ]);
      if (itemRes.data) {
        const i = itemRes.data as InventoryItem;
        setItem(i);
        setForm({
          name: i.name,
          description: i.description ?? '',
          serial_number: i.serial_number ?? '',
          category: i.category,
          status: i.status,
          daily_rate: String(i.daily_rate),
          weekly_rate: String(i.weekly_rate ?? ''),
          replacement_value: String(i.replacement_value ?? ''),
          purchase_date: i.purchase_date ?? '',
          purchase_price: String(i.purchase_price ?? ''),
          depreciation_rate: String(i.depreciation_rate ?? 15),
          location: i.location ?? '',
          notes: i.notes ?? '',
        });
      }
      setDamages(dmgRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('inventory_items').update({
      name: form.name.trim(),
      description: form.description || null,
      serial_number: form.serial_number || null,
      category: form.category,
      status: form.status,
      daily_rate: parseFloat(form.daily_rate) || 0,
      weekly_rate: parseFloat(form.weekly_rate) || 0,
      replacement_value: form.replacement_value ? parseFloat(form.replacement_value) : null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      depreciation_rate: parseFloat(form.depreciation_rate) || 15,
      location: form.location || null,
      notes: form.notes || null,
    }).eq('id', id);
    if (err) { setError(err.message); setSaving(false); return; }
    router.push('/inventory');
  }

  if (loading) return <div className="text-gray-400 text-center py-20">Loading…</div>;
  if (!item) return <div className="text-gray-400 text-center py-20">Item not found.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit: {item.name}</h1>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${ITEM_STATUS_COLORS[item.status]}`}>
          {item.status}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Item Name *" value={form.name} onChange={e => set('name', e.target.value)} required />
            <TextArea label="Description" value={form.description} onChange={e => set('description', e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Serial Number" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
              <Input label="Storage Location" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Category" options={CATEGORY_OPTIONS} value={form.category} onChange={e => set('category', e.target.value)} />
              <Select label="Status" options={STATUS_OPTIONS} value={form.status} onChange={e => set('status', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rental Rates</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Daily Rate ($)" type="number" min="0" step="0.01" value={form.daily_rate} onChange={e => set('daily_rate', e.target.value)} required />
              <Input label="Weekly Rate ($)" type="number" min="0" step="0.01" value={form.weekly_rate} onChange={e => set('weekly_rate', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Asset Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Purchase Date" type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
              <Input label="Purchase Price ($)" type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Replacement Value ($)" type="number" min="0" step="0.01" value={form.replacement_value} onChange={e => set('replacement_value', e.target.value)} />
              <Input label="Annual Depreciation (%)" type="number" min="0" max="100" step="0.1" value={form.depreciation_rate} onChange={e => set('depreciation_rate', e.target.value)} />
            </div>
            {item.current_value != null && (
              <p className="text-sm text-gray-500">
                Current depreciated value: <span className="font-semibold text-gray-700">{formatCurrency(item.current_value)}</span>
              </p>
            )}
            <TextArea label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </CardContent>
        </Card>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Link href="/inventory"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>

      {/* Damage history */}
      {damages.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Damage History</CardTitle></CardHeader>
          <CardContent className="space-y-2 p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Severity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Repair Cost</th>
                </tr>
              </thead>
              <tbody>
                {damages.map(d => (
                  <tr key={d.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-600">{formatDate(d.reported_date)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        d.severity === 'total_loss' ? 'bg-red-100 text-red-700' :
                        d.severity === 'severe' ? 'bg-orange-100 text-orange-700' :
                        d.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {d.severity.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{d.description}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{d.repair_cost ? formatCurrency(d.repair_cost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
