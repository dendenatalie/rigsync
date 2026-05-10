// ============================================================
// AV Rental System - TypeScript Types
// ============================================================

export type ItemStatus = 'available' | 'rented' | 'maintenance' | 'retired' | 'lost' | 'damaged';
export type ItemCategory = 'audio' | 'video' | 'lighting' | 'rigging' | 'backline' | 'staging' | 'power' | 'cable' | 'misc';
export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'invoiced' | 'paid' | 'cancelled' | 'overdue';
export type TransactionType = 'payment' | 'refund' | 'expense' | 'deposit' | 'damage_charge' | 'late_fee';
export type DamageSeverity = 'minor' | 'moderate' | 'severe' | 'total_loss';

export interface Customer {
  id: string;
  company_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country: string;
  notes?: string;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  serial_number?: string;
  category: ItemCategory;
  status: ItemStatus;
  daily_rate: number;
  weekly_rate: number;
  replacement_value?: number;
  purchase_date?: string;
  purchase_price?: number;
  depreciation_rate: number;
  current_value?: number;
  location?: string;
  notes?: string;
  image_url?: string;
  is_kit: boolean;
  created_at: string;
  updated_at: string;
}

export interface Kit {
  id: string;
  name: string;
  description?: string;
  daily_rate?: number;
  weekly_rate?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  kit_items?: KitItem[];
}

export interface KitItem {
  id: string;
  kit_id: string;
  item_id: string;
  quantity: number;
  inventory_items?: InventoryItem;
}

export interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  status: DocumentStatus;
  event_name?: string;
  event_location?: string;
  rental_start: string;
  rental_end: string;
  rental_days: number;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  labor_cost: number;
  delivery_fee: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  internal_notes?: string;
  valid_until?: string;
  sent_at?: string;
  approved_at?: string;
  invoiced_at?: string;
  paid_at?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  customers?: Customer;
  quote_items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  item_id?: string;
  kit_id?: string;
  description: string;
  quantity: number;
  daily_rate: number;
  weekly_rate?: number;
  days: number;
  line_total: number;
  sort_order: number;
  inventory_items?: InventoryItem;
  kits?: Kit;
}

export interface RentalBooking {
  id: string;
  quote_id: string;
  item_id: string;
  rental_start: string;
  rental_end: string;
  created_at: string;
}

export interface FinancialTransaction {
  id: string;
  quote_id?: string;
  customer_id?: string;
  type: TransactionType;
  amount: number;
  description: string;
  payment_method?: string;
  reference?: string;
  transaction_date: string;
  created_at: string;
  customers?: Customer;
  quotes?: Quote;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  vendor?: string;
  expense_date: string;
  receipt_url?: string;
  notes?: string;
  created_at: string;
}

export interface DamageReport {
  id: string;
  item_id: string;
  quote_id?: string;
  customer_id?: string;
  severity: DamageSeverity;
  description: string;
  repair_cost?: number;
  charged_amount: number;
  is_charged: boolean;
  reported_date: string;
  repaired_date?: string;
  notes?: string;
  image_urls?: string[];
  created_at: string;
  updated_at: string;
  inventory_items?: InventoryItem;
  customers?: Customer;
  quotes?: Quote;
}

// Form input types
export type CustomerFormData = Omit<Customer, 'id' | 'outstanding_balance' | 'created_at' | 'updated_at'>;
export type InventoryItemFormData = Omit<InventoryItem, 'id' | 'is_kit' | 'created_at' | 'updated_at'>;
export type QuoteFormData = {
  customer_id: string;
  event_name?: string;
  event_location?: string;
  rental_start: string;
  rental_end: string;
  notes?: string;
  internal_notes?: string;
  labor_cost: number;
  delivery_fee: number;
  tax_rate: number;
  valid_until?: string;
  due_date?: string;
  items: QuoteItemInput[];
};

export type QuoteItemInput = {
  item_id?: string;
  kit_id?: string;
  description: string;
  quantity: number;
  daily_rate: number;
  days: number;
};

// Dashboard stats
export interface DashboardStats {
  total_revenue_month: number;
  total_expenses_month: number;
  active_rentals: number;
  overdue_invoices: number;
  overdue_amount: number;
  available_items: number;
  rented_items: number;
  maintenance_items: number;
}

// Finance chart data
export interface MonthlyFinancials {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  sent:      'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  invoiced:  'bg-purple-100 text-purple-700',
  paid:      'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  overdue:   'bg-orange-100 text-orange-700',
};

export const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft:     ['sent', 'cancelled'],
  sent:      ['approved', 'cancelled', 'draft'],
  approved:  ['invoiced', 'cancelled'],
  invoiced:  ['paid', 'overdue', 'cancelled'],
  overdue:   ['paid', 'cancelled'],
  paid:      [],
  cancelled: ['draft'],
};

export const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  available:   'bg-green-100 text-green-700',
  rented:      'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  retired:     'bg-gray-100 text-gray-600',
  lost:        'bg-red-100 text-red-700',
  damaged:     'bg-orange-100 text-orange-700',
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  audio:    'Audio',
  video:    'Video',
  lighting: 'Lighting',
  rigging:  'Rigging',
  backline: 'Backline',
  staging:  'Staging',
  power:    'Power',
  cable:    'Cables',
  misc:     'Miscellaneous',
};
