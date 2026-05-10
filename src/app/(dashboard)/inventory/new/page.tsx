'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CATEGORY_LABELS } from '@/types';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

export default function NewInventoryItemPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    serial_number: '',
    category: 'audio',
    status: 'available',
    daily_rate: '',
    weekly_rate: '',
    replacement_value: '',
    purchase_date: '',
    purchase_price: '',
    depreciation_rate: '15',
    location: '',
    notes: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const supabase = createClient();
    const payload = {
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
    };

    const { error: err } = await supabase.from('inventory_items').insert(payload);
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    router.push('/inventory');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Inventory Item</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Item Name *" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g., Shure SM58 Microphone" />
            <TextArea label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description…" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Serial Number" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="SN123456" />
              <Input label="Storage Location" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Rack A, Shelf 2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Category *" options={CATEGORY_OPTIONS} value={form.category} onChange={e => set('category', e.target.value)} />
              <Select label="Status *" options={STATUS_OPTIONS} value={form.status} onChange={e => set('status', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rental Rates</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Daily Rate ($) *"
                type="number"
                min="0"
                step="0.01"
                value={form.daily_rate}
                onChange={e => set('daily_rate', e.target.value)}
                required
                placeholder="0.00"
              />
              <Input
                label="Weekly Rate ($)"
                type="number"
                min="0"
                step="0.01"
                value={form.weekly_rate}
                onChange={e => set('weekly_rate', e.target.value)}
                placeholder="0.00"
                hint="Leave blank to use daily × 7"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Asset & Depreciation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Purchase Date" type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
              <Input label="Purchase Price ($)" type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Replacement Value ($)" type="number" min="0" step="0.01" value={form.replacement_value} onChange={e => set('replacement_value', e.target.value)} placeholder="0.00" />
              <Input label="Annual Depreciation Rate (%)" type="number" min="0" max="100" step="0.1" value={form.depreciation_rate} onChange={e => set('depreciation_rate', e.target.value)} hint="Default 15%" />
            </div>
            <TextArea label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
          </CardContent>
        </Card>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Link href="/inventory"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit" loading={saving}>Save Item</Button>
        </div>
      </form>
    </div>
  );
}
