-- ============================================================
-- AV Rental Management System - Complete Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name  TEXT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  country       TEXT DEFAULT 'US',
  notes         TEXT,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================
CREATE TYPE item_status AS ENUM ('available', 'rented', 'maintenance', 'retired', 'lost', 'damaged');
CREATE TYPE item_category AS ENUM ('audio', 'video', 'lighting', 'rigging', 'backline', 'staging', 'power', 'cable', 'misc');

CREATE TABLE inventory_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  serial_number   TEXT UNIQUE,
  category        item_category NOT NULL DEFAULT 'misc',
  status          item_status NOT NULL DEFAULT 'available',
  daily_rate      NUMERIC(10,2) NOT NULL DEFAULT 0,
  weekly_rate     NUMERIC(10,2) NOT NULL DEFAULT 0,
  replacement_value NUMERIC(10,2),
  purchase_date   DATE,
  purchase_price  NUMERIC(10,2),
  depreciation_rate NUMERIC(5,2) DEFAULT 15, -- annual % depreciation
  current_value   NUMERIC(10,2),
  location        TEXT,
  notes           TEXT,
  image_url       TEXT,
  is_kit          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KITS (bundles of inventory items)
-- ============================================================
CREATE TABLE kits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  daily_rate  NUMERIC(10,2),   -- override rate; NULL = sum of components
  weekly_rate NUMERIC(10,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kit_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id     UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1,
  UNIQUE(kit_id, item_id)
);

-- ============================================================
-- QUOTES / INVOICES
-- ============================================================
CREATE TYPE document_status AS ENUM ('draft', 'sent', 'approved', 'invoiced', 'paid', 'cancelled', 'overdue');

CREATE TABLE quotes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number     TEXT UNIQUE NOT NULL,
  customer_id      UUID NOT NULL REFERENCES customers(id),
  status           document_status NOT NULL DEFAULT 'draft',
  event_name       TEXT,
  event_location   TEXT,
  rental_start     DATE NOT NULL,
  rental_end       DATE NOT NULL,
  rental_days      INTEGER GENERATED ALWAYS AS (rental_end - rental_start + 1) STORED,
  subtotal         NUMERIC(12,2) DEFAULT 0,
  discount_pct     NUMERIC(5,2) DEFAULT 0,  -- multi-day discount %
  discount_amount  NUMERIC(12,2) DEFAULT 0,
  labor_cost       NUMERIC(12,2) DEFAULT 0,
  delivery_fee     NUMERIC(12,2) DEFAULT 0,
  tax_rate         NUMERIC(5,2) DEFAULT 0,
  tax_amount       NUMERIC(12,2) DEFAULT 0,
  total            NUMERIC(12,2) DEFAULT 0,
  notes            TEXT,
  internal_notes   TEXT,
  valid_until      DATE,
  sent_at          TIMESTAMPTZ,
  approved_at      TIMESTAMPTZ,
  invoiced_at      TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  due_date         DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Line items for quotes (can reference individual items or kits)
CREATE TABLE quote_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id      UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES inventory_items(id),
  kit_id        UUID REFERENCES kits(id),
  description   TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  daily_rate    NUMERIC(10,2) NOT NULL DEFAULT 0,
  weekly_rate   NUMERIC(10,2),
  days          INTEGER NOT NULL DEFAULT 1,
  line_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order    INTEGER DEFAULT 0,
  CHECK (item_id IS NOT NULL OR kit_id IS NOT NULL)
);

-- Rental booking records (tracks which items are booked for which dates)
CREATE TABLE rental_bookings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id     UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES inventory_items(id),
  rental_start DATE NOT NULL,
  rental_end   DATE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCIAL TRANSACTIONS
-- ============================================================
CREATE TYPE transaction_type AS ENUM ('payment', 'refund', 'expense', 'deposit', 'damage_charge', 'late_fee');

CREATE TABLE financial_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID REFERENCES quotes(id),
  customer_id     UUID REFERENCES customers(id),
  type            transaction_type NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  description     TEXT NOT NULL,
  payment_method  TEXT,   -- 'cash','check','card','bank_transfer','venmo', etc.
  reference       TEXT,   -- check # or transaction ID
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- General expenses (not tied to a specific quote)
CREATE TABLE expenses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category         TEXT NOT NULL,  -- 'labor','fuel','storage','insurance','repair',etc.
  description      TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  vendor           TEXT,
  expense_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DAMAGE / LOSS TRACKING
-- ============================================================
CREATE TYPE damage_severity AS ENUM ('minor', 'moderate', 'severe', 'total_loss');

CREATE TABLE damage_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id         UUID NOT NULL REFERENCES inventory_items(id),
  quote_id        UUID REFERENCES quotes(id),
  customer_id     UUID REFERENCES customers(id),
  severity        damage_severity NOT NULL DEFAULT 'minor',
  description     TEXT NOT NULL,
  repair_cost     NUMERIC(10,2),
  charged_amount  NUMERIC(10,2) DEFAULT 0,
  is_charged      BOOLEAN DEFAULT FALSE,
  reported_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  repaired_date   DATE,
  notes           TEXT,
  image_urls      TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEQUENCE GENERATOR for quote numbers
-- ============================================================
CREATE SEQUENCE quote_number_seq START 1000;

-- Auto-generate quote numbers
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := 'QUO-' || LPAD(nextval('quote_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER kits_updated_at BEFORE UPDATE ON kits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER damage_reports_updated_at BEFORE UPDATE ON damage_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AVAILABILITY CHECK FUNCTION
-- Returns items that are booked during a date range
-- ============================================================
CREATE OR REPLACE FUNCTION get_booked_items(
  p_start DATE,
  p_end   DATE,
  p_exclude_quote_id UUID DEFAULT NULL
)
RETURNS TABLE(item_id UUID) AS $$
BEGIN
  RETURN QUERY
    SELECT rb.item_id
    FROM rental_bookings rb
    JOIN quotes q ON rb.quote_id = q.id
    WHERE q.status NOT IN ('cancelled', 'draft')
      AND (p_exclude_quote_id IS NULL OR rb.quote_id != p_exclude_quote_id)
      AND rb.rental_start <= p_end
      AND rb.rental_end   >= p_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MULTI-DAY DISCOUNT FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_multiday_discount(p_days INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  -- Discount tiers
  CASE
    WHEN p_days >= 28 THEN RETURN 30.00;  -- 28+ days: 30%
    WHEN p_days >= 14 THEN RETURN 20.00;  -- 2 weeks:  20%
    WHEN p_days >= 7  THEN RETURN 15.00;  -- 1 week:   15%
    WHEN p_days >= 4  THEN RETURN 10.00;  -- 4-6 days: 10%
    WHEN p_days >= 2  THEN RETURN 5.00;   -- 2-3 days: 5%
    ELSE RETURN 0.00;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DEPRECIATION UPDATE FUNCTION (run periodically)
-- ============================================================
CREATE OR REPLACE FUNCTION update_equipment_values()
RETURNS VOID AS $$
BEGIN
  UPDATE inventory_items
  SET current_value = GREATEST(
    0,
    purchase_price * POWER(1 - depreciation_rate/100,
      EXTRACT(YEAR FROM AGE(NOW(), purchase_date))
    )
  )
  WHERE purchase_price IS NOT NULL
    AND purchase_date IS NOT NULL
    AND depreciation_rate IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CUSTOMER BALANCE UPDATE FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_balance(p_customer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE customers c
  SET outstanding_balance = (
    -- Total invoiced
    COALESCE((
      SELECT SUM(q.total) FROM quotes q
      WHERE q.customer_id = p_customer_id
        AND q.status IN ('invoiced', 'overdue')
    ), 0)
    -- Minus payments received
    - COALESCE((
      SELECT SUM(ft.amount) FROM financial_transactions ft
      WHERE ft.customer_id = p_customer_id
        AND ft.type = 'payment'
    ), 0)
  )
  WHERE c.id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_inventory_status ON inventory_items(status);
CREATE INDEX idx_inventory_category ON inventory_items(category);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_dates ON quotes(rental_start, rental_end);
CREATE INDEX idx_rental_bookings_dates ON rental_bookings(rental_start, rental_end);
CREATE INDEX idx_rental_bookings_item ON rental_bookings(item_id);
CREATE INDEX idx_transactions_customer ON financial_transactions(customer_id);
CREATE INDEX idx_transactions_quote ON financial_transactions(quote_id);
CREATE INDEX idx_damage_item ON damage_reports(item_id);

-- ============================================================
-- ROW LEVEL SECURITY (enable for Supabase auth)
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do all operations (adjust as needed for team roles)
CREATE POLICY "authenticated_all" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON inventory_items FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON kits FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON kit_items FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON quotes FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON quote_items FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON rental_bookings FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON financial_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON expenses FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all" ON damage_reports FOR ALL TO authenticated USING (true);
