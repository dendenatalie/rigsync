'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InventoryItem } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
import Link from 'next/link';

interface KitLine { item: InventoryItem; quantity: number; }

export default function NewKitPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<KitLine[]>([]);
  const [form, setForm] = useState({ name: '', description: '', daily_rate: '', weekly_rate: '', notes: '' });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .not('status', 'eq', 'retired')
        .order('category').order('name');
      setAllItems(data ?? []);
    }
    load();
  }, []);

  const filtered = allItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) &&
    !lines.some(l => l.item.id === i.id)
  );

  const addItem = (item: InventoryItem) => {
    setLines(p => [...p, { item, quantity: 1 }]);
    setSearch('');
  };

  const removeItem = (id: string) => setLines(p => p.filter(l => l.item.id !== id));
  const setQty = (id: string, qty: number) => setLines(p => p.map(l => l.item.id === id ? { ...l, quantity: qty } : l));

  const totalDaily = parseFloat(form.daily_rate) || lines.reduce((s, l) => s + l.item.daily_rate * l.quantity, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { setError('Add at least one item to the kit.'); return; }
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { data: kit, error: err } = await supabase.from('kits').insert({
      name: form.name.trim(),
      description: form.description || null,
      daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null,
      weekly_rate: form.weekly_rate ? parseFloat(form.weekly_rate) : null,
      notes: form.notes || null,
    }).select().single();
    if (err || !kit) { setError(err?.message ?? 'Failed to create kit'); setSaving(false); return; }

    const { error: itemsErr } = await supabase.from('kit_items').insert(
      lines.map(l => ({ kit_id: kit.id, item_id: l.item.id, quantity: l.quantity }))
    );
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }
    router.push('/inventory/kits');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory/kits">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Kit</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Kit Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Kit Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g., Small PA System" />
            <TextArea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's included in this kit…" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Override Daily Rate ($)" type="number" min="0" step="0.01" value={form.daily_rate} onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))} placeholder="Leave blank to auto-calculate" hint="Blank = sum of components" />
              <Input label="Override Weekly Rate ($)" type="number" min="0" step="0.01" value={form.weekly_rate} onChange={e => setForm(p => ({ ...p, weekly_rate: e.target.value }))} placeholder="Leave blank" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items in Kit</CardTitle>
              <span className="text-sm font-bold text-indigo-600">{formatCurrency(totalDaily)}/day</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected items */}
            {lines.length > 0 && (
              <div className="space-y-2">
                {lines.map(l => (
                  <div key={l.item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.item.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(l.item.daily_rate)}/day each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQty(l.item.id, Math.max(1, l.quantity - 1))}
                        className="w-6 h-6 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 text-sm flex items-center justify-center">−</button>
                      <span className="w-6 text-center text-sm font-medium">{l.quantity}</span>
                      <button type="button" onClick={() => setQty(l.item.id, l.quantity + 1)}
                        className="w-6 h-6 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 text-sm flex items-center justify-center">+</button>
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-20 text-right">
                      {formatCurrency(l.item.daily_rate * l.quantity)}/day
                    </span>
                    <button type="button" onClick={() => removeItem(l.item.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Item search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items to add…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {search && filtered.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {filtered.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors"
                  >
                    <Plus size={14} className="text-indigo-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.category} · {formatCurrency(item.daily_rate)}/day</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Link href="/inventory/kits"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit" loading={saving}>Create Kit</Button>
        </div>
      </form>
    </div>
  );
}
