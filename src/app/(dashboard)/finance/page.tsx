'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Quote, Expense } from '@/types';
import { formatCurrency, formatDate, daysPastDue } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts';
import { AlertTriangle, Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Quote[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseModal, setExpenseModal] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [totals, setTotals] = useState({ revenue: 0, expenses: 0, outstanding: 0 });
  const [expenseForm, setExpenseForm] = useState({
    category: 'labor', description: '', amount: '', vendor: '',
    expense_date: new Date().toISOString().split('T')[0], notes: '',
  });

  const EXPENSE_CATEGORIES = [
    { value: 'labor', label: 'Labor' },
    { value: 'fuel', label: 'Fuel / Transport' },
    { value: 'storage', label: 'Storage / Warehouse' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'repair', label: 'Repair / Maintenance' },
    { value: 'equipment', label: 'Equipment Purchase' },
    { value: 'software', label: 'Software / Subscriptions' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      const startDate = twelveMonthsAgo.toISOString().split('T')[0];

      const [txRes, expRes, quotesRes] = await Promise.all([
        supabase.from('financial_transactions')
          .select('amount, type, transaction_date')
          .gte('transaction_date', startDate)
          .order('transaction_date'),
        supabase.from('expenses')
          .select('*')
          .order('expense_date', { ascending: false })
          .limit(50),
        supabase.from('quotes')
          .select('*, customers(first_name, last_name, company_name)')
          .in('status', ['invoiced', 'overdue'])
          .order('due_date'),
      ]);

      // Build monthly data
      const monthMap: Record<string, MonthlyData> = {};
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthMap[key] = { month: label, revenue: 0, expenses: 0, profit: 0 };
      }

      // Payments → revenue
      for (const tx of txRes.data ?? []) {
        const key = tx.transaction_date.slice(0, 7);
        if (monthMap[key]) {
          if (tx.type === 'payment') monthMap[key].revenue += tx.amount;
          else if (tx.type === 'expense') monthMap[key].expenses += tx.amount;
        }
      }

      // Expenses from expense table
      for (const exp of expRes.data ?? []) {
        const key = (exp.expense_date as string).slice(0, 7);
        if (monthMap[key]) monthMap[key].expenses += exp.amount;
      }

      for (const m of Object.values(monthMap)) {
        m.profit = m.revenue - m.expenses;
      }

      const allMonths = Object.values(monthMap);
      setMonthlyData(allMonths);

      const totalRevenue = allMonths.reduce((s, m) => s + m.revenue, 0);
      const totalExpenses = allMonths.reduce((s, m) => s + m.expenses, 0);

      const allQuotes: Quote[] = quotesRes.data ?? [];
      const overdue = allQuotes.filter(q => q.due_date && q.due_date < today);
      const outstanding = allQuotes.reduce((s, q) => s + q.total, 0);

      setOverdueInvoices(overdue);
      setExpenses(expRes.data ?? []);
      setTotals({ revenue: totalRevenue, expenses: totalExpenses, outstanding });
      setLoading(false);
    }
    load();
  }, []);

  async function addExpense() {
    setSavingExpense(true);
    const supabase = createClient();
    await supabase.from('expenses').insert({
      category: expenseForm.category,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      vendor: expenseForm.vendor || null,
      expense_date: expenseForm.expense_date,
      notes: expenseForm.notes || null,
    });
    setSavingExpense(false);
    setExpenseModal(false);
    // Reload
    const { data } = await createClient().from('expenses').select('*').order('expense_date', { ascending: false }).limit(50);
    setExpenses(data ?? []);
  }

  const thisMonth = monthlyData[monthlyData.length - 1];
  const lastMonth = monthlyData[monthlyData.length - 2];
  const revTrend = lastMonth?.revenue > 0
    ? Math.round(((thisMonth?.revenue ?? 0) - lastMonth.revenue) / lastMonth.revenue * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue, expenses, and cash flow — last 12 months</p>
        </div>
        <Button size="sm" onClick={() => setExpenseModal(true)}>
          <Plus size={14} /> Log Expense
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="12-Month Revenue"
          value={loading ? '…' : formatCurrency(totals.revenue)}
          trend={{ value: revTrend, label: 'vs last month' }}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          title="12-Month Expenses"
          value={loading ? '…' : formatCurrency(totals.expenses)}
          icon={<TrendingDown size={20} />}
        />
        <StatCard
          title="Outstanding Balance"
          value={loading ? '…' : formatCurrency(totals.outstanding)}
          subtitle={`${overdueInvoices.length} overdue invoice${overdueInvoices.length !== 1 ? 's' : ''}`}
          className={overdueInvoices.length > 0 ? 'border-orange-200' : ''}
          icon={<DollarSign size={20} />}
        />
      </div>

      {/* Overdue alerts */}
      {overdueInvoices.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle size={16} className="text-orange-500" />
              Overdue Invoices (30+ days)
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-100">
                  <th className="px-4 py-2 text-left text-xs font-medium text-orange-600">Invoice</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-orange-600">Customer</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-orange-600">Due Date</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-orange-600">Days Overdue</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-orange-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.map(q => {
                  const cust = q.customers as { first_name: string; last_name: string; company_name?: string } | null;
                  const days = q.due_date ? daysPastDue(q.due_date) : 0;
                  return (
                    <tr key={q.id} className="border-b border-orange-100">
                      <td className="px-4 py-2">
                        <Link href={`/quotes/${q.id}`} className="font-mono text-indigo-600 hover:underline text-xs">{q.quote_number}</Link>
                      </td>
                      <td className="px-4 py-2 text-gray-800">{cust?.company_name ?? `${cust?.first_name} ${cust?.last_name}`}</td>
                      <td className="px-4 py-2 text-gray-600">{q.due_date ? formatDate(q.due_date) : '—'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${days >= 30 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {days}d
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-orange-800">{formatCurrency(q.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Revenue vs Expenses chart */}
      <Card>
        <CardHeader><CardTitle>Revenue vs Expenses — Last 12 Months</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Profit line chart */}
      <Card>
        <CardHeader><CardTitle>Net Profit Trend</CardTitle></CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Net Profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expense log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Expenses</CardTitle>
            <button onClick={() => setExpenseModal(true)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              + Log expense
            </button>
          </div>
        </CardHeader>
        {expenses.length === 0 ? (
          <CardContent><p className="text-gray-400 text-sm text-center py-4">No expenses logged.</p></CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Vendor</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{formatDate(exp.expense_date)}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">{exp.category}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-800">{exp.description}</td>
                    <td className="px-4 py-2 text-gray-500">{exp.vendor ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">{formatCurrency(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add expense modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Log Expense">
        <div className="space-y-4">
          <Select
            label="Category"
            options={EXPENSE_CATEGORIES}
            value={expenseForm.category}
            onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}
          />
          <Input
            label="Description *"
            value={expenseForm.description}
            onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount ($) *" type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} required />
            <Input label="Date" type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} />
          </div>
          <Input label="Vendor" value={expenseForm.vendor} onChange={e => setExpenseForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Optional" />
          <TextArea label="Notes" value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setExpenseModal(false)}>Cancel</Button>
            <Button onClick={addExpense} loading={savingExpense}>Log Expense</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
