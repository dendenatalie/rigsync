'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Save, Palette, Building2, CreditCard, Eye, FileText, Plus, Pencil, Trash2, Star, Users, UserPlus, Loader2, Mail } from 'lucide-react';

interface AppSettings {
  id: string;
  company_name: string;
  company_tagline: string;
  company_logo_url: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_zip: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  primary_color: string;
  secondary_color: string;
  invoice_footer: string;
  tax_id: string;
  stripe_enabled: boolean;
}

interface TermsTemplate {
  id: string;
  type: 'payment_terms' | 'project_terms';
  name: string;
  body: string;
  is_default: boolean;
  sort_order: number;
}

const PRESET_COLORS = [
  { label: 'Indigo',  value: '#4338CA' },
  { label: 'Blue',    value: '#1D4ED8' },
  { label: 'Teal',    value: '#0F766E' },
  { label: 'Green',   value: '#15803D' },
  { label: 'Black',   value: '#111827' },
  { label: 'Red',     value: '#B91C1C' },
  { label: 'Orange',  value: '#C2410C' },
  { label: 'Purple',  value: '#7C3AED' },
];

function ColorPicker({ label, field, value, onChange }: {
  label: string;
  field: string;
  value: string;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="w-5 h-5 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: value }} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(field, c.value)}
            title={c.label}
            className={`w-7 h-7 rounded-full border-2 transition-all ${value === c.value ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={e => onChange(field, e.target.value)}
          className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer p-0.5"
        />
        <Input
          value={value}
          onChange={e => onChange(field, e.target.value)}
          placeholder="#4338CA"
          className="w-32 font-mono text-sm"
        />
      </div>
    </div>
  );
}

function TermsLibrary({ type, label }: { type: 'payment_terms' | 'project_terms'; label: string }) {
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TermsTemplate | null>(null);
  const [form, setForm] = useState({ name: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from('terms_templates')
      .select('*')
      .eq('type', type)
      .order('sort_order')
      .order('created_at');
    setTemplates((data ?? []) as TermsTemplate[]);
  }

  useEffect(() => { load(); }, [type]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', body: '' });
    setModalOpen(true);
  }

  function openEdit(t: TermsTemplate) {
    setEditing(t);
    setForm({ name: t.name, body: t.body });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    const supabase = createClient();
    if (editing) {
      await supabase.from('terms_templates').update({ name: form.name, body: form.body }).eq('id', editing.id);
    } else {
      await supabase.from('terms_templates').insert({ type, name: form.name, body: form.body, is_default: false });
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this template?')) return;
    await createClient().from('terms_templates').delete().eq('id', id);
    load();
  }

  async function setDefault(id: string) {
    const supabase = createClient();
    await supabase.from('terms_templates').update({ is_default: false }).eq('type', type);
    await supabase.from('terms_templates').update({ is_default: true }).eq('id', id);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {templates.length === 0 && (
        <p className="text-xs text-gray-400 italic py-2">No templates yet — click Add to create one.</p>
      )}

      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            >
              {t.is_default && <Star size={12} className="text-amber-500 fill-amber-400 flex-shrink-0" />}
              <span className="text-sm font-medium text-gray-800 flex-1">{t.name}</span>
              <div className="flex items-center gap-1">
                {!t.is_default && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDefault(t.id); }}
                    title="Set as default"
                    className="p-1 text-gray-400 hover:text-amber-500 rounded"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); openEdit(t); }}
                  className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); remove(t.id); }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {expanded === t.id && (
              <div className="px-3 py-2 bg-white text-xs text-gray-600 whitespace-pre-wrap border-t border-gray-100 max-h-40 overflow-y-auto">
                {t.body}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit: ${editing.name}` : `New ${label}`}>
        <div className="space-y-4">
          <Input
            label="Template Name"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Net 30, Standard Agreement…"
          />
          <TextArea
            label="Content"
            value={form.body}
            onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
            placeholder="Enter the full text…"
            rows={10}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save Template</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface TeamUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  invited_at: string | null;
}

function TeamMembers() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');

  async function loadUsers() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const res = await fetch('/api/auth/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    const res = await fetch('/api/auth/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();

    if (!res.ok) {
      setInviteError(data.error ?? 'Failed to send invite');
    } else {
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      loadUsers();
    }
    setInviting(false);
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from the team? They will lose access immediately.`)) return;
    setRemoving(userId);
    const res = await fetch('/api/auth/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? 'Failed to remove user');
    } else {
      loadUsers();
    }
    setRemoving(null);
  }

  return (
    <div className="space-y-5">
      {/* Invite form */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Invite a team member</p>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition"
          >
            {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Invite
          </button>
        </form>
        {inviteError && <p className="text-xs text-red-600 mt-1.5">{inviteError}</p>}
        {inviteSuccess && <p className="text-xs text-green-600 mt-1.5">{inviteSuccess}</p>}
        <p className="text-xs text-gray-400 mt-1.5">They'll receive an email to set their password and log in.</p>
      </div>

      {/* User list */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Team members</p>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : users.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-2">No team members found.</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-700 text-xs font-semibold uppercase">{u.email[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                    {u.email}
                    {u.id === currentUserId && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-normal">You</span>
                    )}
                    {u.invited_at && !u.last_sign_in_at && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-normal flex items-center gap-0.5">
                        <Mail size={10} /> Pending
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {u.last_sign_in_at
                      ? `Last login: ${new Date(u.last_sign_in_at).toLocaleDateString()}`
                      : `Added: ${new Date(u.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                {u.id !== currentUserId && (
                  <button
                    onClick={() => handleRemove(u.id, u.email)}
                    disabled={removing === u.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Remove user"
                  >
                    {removing === u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settingsId, setSettingsId] = useState('');
  const [form, setForm] = useState<Omit<AppSettings, 'id'>>({
    company_name: '',
    company_tagline: '',
    company_logo_url: '',
    company_address: '',
    company_city: '',
    company_state: '',
    company_zip: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    primary_color: '#4338CA',
    secondary_color: '#6366F1',
    invoice_footer: 'Thank you for your business!',
    tax_id: '',
    stripe_enabled: false,
  });

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from('app_settings').select('*').limit(1).single();
      if (data) {
        setSettingsId(data.id);
        setForm({
          company_name: data.company_name ?? '',
          company_tagline: data.company_tagline ?? '',
          company_logo_url: data.company_logo_url ?? '',
          company_address: data.company_address ?? '',
          company_city: data.company_city ?? '',
          company_state: data.company_state ?? '',
          company_zip: data.company_zip ?? '',
          company_phone: data.company_phone ?? '',
          company_email: data.company_email ?? '',
          company_website: data.company_website ?? '',
          primary_color: data.primary_color ?? '#4338CA',
          secondary_color: data.secondary_color ?? '#6366F1',
          invoice_footer: data.invoice_footer ?? '',
          tax_id: data.tax_id ?? '',
          stripe_enabled: data.stripe_enabled ?? false,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('app_settings').update({ ...form, updated_at: new Date().toISOString() }).eq('id', settingsId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  const previewColor = form.primary_color || '#4338CA';
  const previewSecondary = form.secondary_color || '#6366F1';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings & Branding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customize your invoices and company details</p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save size={14} />
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">

          {/* Company info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 size={16} className="text-indigo-500" /> Company Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="Company Name" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Your Company Name" />
              <Input label="Tagline" value={form.company_tagline} onChange={e => set('company_tagline', e.target.value)} placeholder="Professional A/V Rental" />
              <Input label="Logo URL" value={form.company_logo_url} onChange={e => set('company_logo_url', e.target.value)} placeholder="https://… (paste a hosted image URL)" hint="Use a direct link to a .png or .jpg image" />
              <Input label="Phone" value={form.company_phone} onChange={e => set('company_phone', e.target.value)} placeholder="(555) 555-5555" />
              <Input label="Email" type="email" value={form.company_email} onChange={e => set('company_email', e.target.value)} placeholder="hello@yourcompany.com" />
              <Input label="Website" value={form.company_website} onChange={e => set('company_website', e.target.value)} placeholder="www.yourcompany.com" />
              <Input label="Tax ID / EIN" value={form.tax_id} onChange={e => set('tax_id', e.target.value)} placeholder="XX-XXXXXXX" />
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader><CardTitle>Business Address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Street Address" value={form.company_address} onChange={e => set('company_address', e.target.value)} placeholder="123 Main St" />
              <div className="grid grid-cols-3 gap-3">
                <Input label="City" value={form.company_city} onChange={e => set('company_city', e.target.value)} className="col-span-1" />
                <Input label="State" value={form.company_state} onChange={e => set('company_state', e.target.value)} placeholder="CA" />
                <Input label="ZIP" value={form.company_zip} onChange={e => set('company_zip', e.target.value)} placeholder="90210" />
              </div>
            </CardContent>
          </Card>

          {/* Terms Library */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={16} className="text-indigo-500" /> Terms Library
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">Templates are selectable per quote. ★ marks the default pre-selected on new quotes.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <TermsLibrary type="payment_terms" label="Payment Terms" />
              <div className="border-t border-gray-100 pt-6">
                <TermsLibrary type="project_terms" label="Project Terms & Conditions" />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <TextArea
                  label="Invoice Footer Message"
                  value={form.invoice_footer}
                  onChange={e => set('invoice_footer', e.target.value)}
                  placeholder="Thank you for your business!"
                  rows={2}
                  hint="Short closing message printed at the bottom of every invoice"
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette size={16} className="text-indigo-500" /> Brand Colors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ColorPicker
                label="Primary Color — invoice header, totals bar"
                field="primary_color"
                value={form.primary_color}
                onChange={set}
              />
              <div className="border-t border-gray-100 pt-5">
                <ColorPicker
                  label="Secondary Color — table accents, highlights"
                  field="secondary_color"
                  value={form.secondary_color}
                  onChange={set}
                />
              </div>
            </CardContent>
          </Card>

          {/* Stripe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={16} className="text-indigo-500" /> Online Payments (Stripe)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="stripe-enabled"
                  checked={form.stripe_enabled}
                  onChange={e => set('stripe_enabled', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="stripe-enabled" className="text-sm font-medium text-gray-800">
                  Enable Stripe credit card payments
                </label>
              </div>
              <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-700">To activate Stripe:</p>
                <p>1. Create an account at <span className="font-mono text-indigo-600">stripe.com</span></p>
                <p>2. Get your Secret Key from Dashboard → Developers → API Keys</p>
                <p>3. Add it to your <span className="font-mono">.env.local</span> file:</p>
                <pre className="bg-white border border-gray-200 rounded p-2 mt-1 text-xs overflow-x-auto">{`STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_APP_URL=http://localhost:3000`}</pre>
              </div>
            </CardContent>
          </Card>
          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={16} className="text-indigo-500" /> Team Members
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">Invite colleagues and manage who has access to RigSync.</p>
            </CardHeader>
            <CardContent>
              <TeamMembers />
            </CardContent>
          </Card>

        </div>

        {/* Right column — live invoice preview */}
        <div className="sticky top-6">
          <div className="flex items-center gap-2 mb-3">
            <Eye size={15} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-600">Live Invoice Preview</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-xs">
            {/* Header */}
            <div className="p-5 text-white" style={{ backgroundColor: previewColor }}>
              <div className="flex items-start justify-between">
                <div>
                  {form.company_logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.company_logo_url} alt="Logo" className="h-10 mb-2 object-contain" />
                  ) : (
                    <div className="text-base font-bold">{form.company_name || 'Your Company'}</div>
                  )}
                  {form.company_tagline && <div className="text-white/80 text-xs mt-0.5">{form.company_tagline}</div>}
                  <div className="mt-2 space-y-0.5 text-white/80">
                    {form.company_address && <div>{form.company_address}</div>}
                    {(form.company_city || form.company_state) && (
                      <div>{[form.company_city, form.company_state, form.company_zip].filter(Boolean).join(', ')}</div>
                    )}
                    {form.company_phone && <div>{form.company_phone}</div>}
                    {form.company_email && <div>{form.company_email}</div>}
                  </div>
                </div>
                <div className="text-right text-white/90">
                  <div className="text-lg font-bold">INVOICE</div>
                  <div>QUO-01001</div>
                  <div>May 10, 2026</div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="uppercase font-semibold mb-1" style={{ fontSize: '9px', color: previewSecondary }}>Bill To</div>
                  <div className="font-semibold text-gray-900">Acme Productions</div>
                  <div className="text-gray-600">John Smith</div>
                  <div className="text-gray-500">john@acme.com</div>
                </div>
                <div>
                  <div className="uppercase font-semibold mb-1" style={{ fontSize: '9px', color: previewSecondary }}>Event</div>
                  <div className="font-semibold text-gray-900">Corporate Gala</div>
                  <div className="text-gray-500">Jun 14 – Jun 15, 2026</div>
                  <div className="text-gray-500">Due: Jul 1, 2026</div>
                </div>
              </div>

              <table className="w-full mb-4">
                <thead>
                  <tr style={{ backgroundColor: `${previewSecondary}18` }}>
                    <th className="text-left py-1.5 px-2 font-semibold" style={{ color: previewSecondary }}>Item</th>
                    <th className="text-right py-1.5 px-2 font-semibold" style={{ color: previewSecondary }}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-1.5 px-2 text-gray-700">Line Array PA System</td><td className="py-1.5 px-2 text-right">$400.00</td></tr>
                  <tr><td className="py-1.5 px-2 text-gray-700">Lighting Package</td><td className="py-1.5 px-2 text-right">$200.00</td></tr>
                  <tr><td className="py-1.5 px-2 text-gray-700">Labor (4 hrs)</td><td className="py-1.5 px-2 text-right">$160.00</td></tr>
                </tbody>
              </table>

              <div className="border-t border-gray-100 pt-2 space-y-0.5">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>$760.00</span></div>
                <div className="flex justify-between text-green-600"><span>10% Discount</span><span>−$76.00</span></div>
                <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-gray-200" style={{ color: previewColor }}>
                  <span>TOTAL</span><span>$684.00</span>
                </div>
              </div>

              {form.invoice_footer && (
                <div className="mt-4 pt-3 border-t border-gray-100 text-gray-400" style={{ fontSize: '9px' }}>
                  <p className="font-medium text-gray-500">{form.invoice_footer}</p>
                  {form.tax_id && <p className="mt-0.5">Tax ID: {form.tax_id}</p>}
                </div>
              )}
            </div>

            <div className="flex h-2">
              <div className="flex-1" style={{ backgroundColor: previewColor }} />
              <div className="flex-1" style={{ backgroundColor: previewSecondary }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
