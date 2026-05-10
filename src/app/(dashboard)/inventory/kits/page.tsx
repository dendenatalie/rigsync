'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Kit } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Package, Edit } from 'lucide-react';

export default function KitsPage() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('kits')
        .select('*, kit_items(*, inventory_items(name, daily_rate))')
        .order('name');
      setKits(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment Kits</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bundle multiple items into one rental line item</p>
        </div>
        <Link href="/inventory/kits/new">
          <Button size="sm"><Plus size={14} /> Create Kit</Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-20">Loading kits…</div>
      ) : kits.length === 0 ? (
        <Card className="p-12 text-center">
          <Package size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No kits yet. Create one to bundle items.</p>
          <Link href="/inventory/kits/new"><Button size="sm"><Plus size={14} /> Create First Kit</Button></Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kits.map(kit => {
            const items = kit.kit_items ?? [];
            const totalDailyRate = kit.daily_rate ?? items.reduce((s, ki) => {
              const rate = (ki.inventory_items as { daily_rate: number } | null)?.daily_rate ?? 0;
              return s + rate * ki.quantity;
            }, 0);

            return (
              <Card key={kit.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{kit.name}</h3>
                    {kit.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{kit.description}</p>
                    )}
                  </div>
                  <Link href={`/inventory/kits/${kit.id}`}>
                    <button className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <Edit size={15} />
                    </button>
                  </Link>
                </div>

                {/* Item list */}
                <ul className="space-y-1 mb-4">
                  {items.map(ki => {
                    const inv = ki.inventory_items as { name: string } | null;
                    return (
                      <li key={ki.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium">
                          {ki.quantity}
                        </span>
                        {inv?.name ?? '—'}
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span className="text-sm font-bold text-indigo-600">{formatCurrency(totalDailyRate)}/day</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
