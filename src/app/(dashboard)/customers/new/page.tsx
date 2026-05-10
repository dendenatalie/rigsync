'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    company_name: '', first_name: '', last_name: '', email: '',
    phone: '', address_line1: '', address_line2: '', city: '',
    state: '', zip: '', country: 'US', notes: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('customers').insert({
      ...form,
      company_name: form.company_name || null,
      phone: form.phone || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      notes: form.notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    router.push('/customers');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers"><Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button></Link>
        <h1 className="text-2xl font-bold text-gray-900">New Customer</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Company Name" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Optional" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name *" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
              <Input label="Last Name *" value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
              <Input label="Phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Address Line 1" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} />
            <Input label="Address Line 2" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} />
            <div className="grid grid-cols-3 gap-4">
              <Input label="City" value={form.city} onChange={e => set('city', e.target.value)} className="col-span-1" />
              <Input label="State" value={form.state} onChange={e => set('state', e.target.value)} placeholder="CA" />
              <Input label="ZIP" value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="90210" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <TextArea label="Customer Notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Preferences, special requirements, etc." />
          </CardContent>
        </Card>
        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Link href="/customers"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit" loading={saving}>Save Customer</Button>
        </div>
      </form>
    </div>
  );
}
