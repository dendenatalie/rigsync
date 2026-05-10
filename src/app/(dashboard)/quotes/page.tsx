'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Quote, STATUS_COLORS } from '@/types';
import { formatCurrency, formatDate, daysPastDue } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Search, FileText, AlertTriangle } from 'lucide-react';

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      let q = supabase
        .from('quotes')
        .select('*, customers(first_name, last_name, company_name)')
        .order('created_at', { ascending: false });
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data } = await q;
      setQuotes(data ?? []);
      setLoading(false);
    }
    load();
  }, [statusFilter]);

  const filtered = quotes.filter(q =>
    !search ||
    q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    q.event_name?.toLowerCase().includes(search.toLowerCase()) ||
    (q.customers as { first_name: string; last_name: string; company_name?: string } | null)?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    `${(q.customers as { first_name: string; last_name: string } | null)?.first_name} ${(q.customers as { first_name: string; last_name: string } | null)?.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const STATUSES = ['draft', 'sent', 'approved', 'invoiced', 'paid', 'overdue', 'cancelled'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes & Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotes.length} total</p>
        </div>
        <Link href="/quotes/new">
          <Button size="sm"><Plus size={14} /> New Quote</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search quotes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!statusFilter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All
          </button>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quote #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rental Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No quotes found. <Link href="/quotes/new" className="text-indigo-600 hover:underline">Create your first quote →</Link>
                  </td>
                </tr>
              ) : (
                filtered.map(q => {
                  const cust = q.customers as { first_name: string; last_name: string; company_name?: string } | null;
                  const overdue = q.due_date && q.status !== 'paid' && q.status !== 'cancelled' && new Date(q.due_date) < new Date();
                  const days = overdue && q.due_date ? daysPastDue(q.due_date) : 0;
                  return (
                    <tr key={q.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <Link href={`/quotes/${q.id}`} className="font-mono text-indigo-600 hover:text-indigo-800 font-medium text-xs">
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {cust?.company_name ?? `${cust?.first_name} ${cust?.last_name}`}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{q.event_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatDate(q.rental_start)} – {formatDate(q.rental_end)}
                        <span className="ml-1 text-gray-400">({q.rental_days}d)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status]}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(q.total)}</td>
                      <td className="px-4 py-3">
                        {q.due_date ? (
                          <div>
                            <p className="text-xs text-gray-600">{formatDate(q.due_date)}</p>
                            {overdue && days > 0 && (
                              <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
                                <AlertTriangle size={10} /> {days}d overdue
                              </p>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
