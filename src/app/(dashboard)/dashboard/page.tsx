'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StatCard } from '@/components/ui/Card';
import { formatCurrency, formatDate, daysPastDue } from '@/lib/utils';
import { Quote } from '@/types';
import Link from 'next/link';
import {
  DollarSign, Package, FileText, AlertTriangle,
  TrendingUp, Clock
} from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    monthRevenue: 0,
    activeRentals: 0,
    overdueCount: 0,
    overdueAmount: 0,
    availableItems: 0,
    rentedItems: 0,
  });
  const [overdueInvoices, setOverdueInvoices] = useState<Quote[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const [txRes, quotesRes, itemsRes, recentRes] = await Promise.all([
        supabase
          .from('financial_transactions')
          .select('amount, type')
          .eq('type', 'payment')
          .gte('transaction_date', monthStart),
        supabase
          .from('quotes')
          .select('*, customers(first_name, last_name, company_name)')
          .in('status', ['invoiced', 'overdue'])
          .order('due_date', { ascending: true }),
        supabase
          .from('inventory_items')
          .select('status')
          .neq('status', 'retired'),
        supabase
          .from('quotes')
          .select('*, customers(first_name, last_name, company_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const monthRevenue = (txRes.data ?? []).reduce((s: number, t: { amount: number }) => s + t.amount, 0);
      const allQuotes: Quote[] = quotesRes.data ?? [];
      const today = new Date().toISOString().split('T')[0];
      const overdue = allQuotes.filter(q => q.due_date && q.due_date < today);
      const overdueAmount = overdue.reduce((s, q) => s + q.total, 0);
      const items: { status: string }[] = itemsRes.data ?? [];
      const available = items.filter(i => i.status === 'available').length;
      const rented = items.filter(i => i.status === 'rented').length;
      const active = (quotesRes.data ?? []).filter((q: Quote) => q.status === 'invoiced').length;

      setStats({
        monthRevenue,
        activeRentals: active,
        overdueCount: overdue.length,
        overdueAmount,
        availableItems: available,
        rentedItems: rented,
      });
      setOverdueInvoices(overdue.slice(0, 5));
      setRecentQuotes(recentRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const STATUS_PILL: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    sent:      'bg-blue-100 text-blue-700',
    approved:  'bg-green-100 text-green-700',
    invoiced:  'bg-purple-100 text-purple-700',
    paid:      'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    overdue:   'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your rental business</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Revenue This Month"
          value={loading ? '…' : formatCurrency(stats.monthRevenue)}
          icon={<DollarSign size={20} />}
        />
        <StatCard
          title="Active Rentals"
          value={loading ? '…' : stats.activeRentals}
          icon={<Package size={20} />}
        />
        <StatCard
          title="Available Items"
          value={loading ? '…' : stats.availableItems}
          subtitle={`${stats.rentedItems} currently rented`}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          title="Overdue Invoices"
          value={loading ? '…' : stats.overdueCount}
          subtitle={loading ? '' : `${formatCurrency(stats.overdueAmount)} outstanding`}
          className={stats.overdueCount > 0 ? 'border-orange-200 bg-orange-50' : ''}
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          title="Quotes & Invoices"
          value={loading ? '…' : recentQuotes.length + '+'}
          icon={<FileText size={20} />}
        />
        <StatCard
          title="Under Repair"
          value={loading ? '…' : '—'}
          icon={<Clock size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue alerts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-500" />
              Overdue Invoices (30+ days)
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : overdueInvoices.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No overdue invoices 🎉</div>
            ) : (
              overdueInvoices.map(q => {
                const days = daysPastDue(q.due_date!);
                const cust = q.customers as { first_name: string; last_name: string; company_name?: string } | null;
                return (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{q.quote_number}</p>
                      <p className="text-xs text-gray-500">
                        {cust?.company_name ?? `${cust?.first_name} ${cust?.last_name}`}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(q.total)}</p>
                      <p className="text-xs text-orange-600 font-medium">{days} days overdue</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Recent quotes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Quotes</h2>
            <Link href="/quotes" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : recentQuotes.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No quotes yet</div>
            ) : (
              recentQuotes.map(q => {
                const cust = q.customers as { first_name: string; last_name: string; company_name?: string } | null;
                return (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{q.quote_number}</p>
                      <p className="text-xs text-gray-500">
                        {cust?.company_name ?? `${cust?.first_name} ${cust?.last_name}`} · {formatDate(q.rental_start)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[q.status] ?? ''}`}>
                        {q.status}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(q.total)}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
