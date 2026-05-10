-- ============================================================
-- App Settings / Branding
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name        TEXT NOT NULL DEFAULT 'Your Company',
  company_tagline     TEXT,
  company_logo_url    TEXT,
  company_address     TEXT,
  company_city        TEXT,
  company_state       TEXT,
  company_zip         TEXT,
  company_phone       TEXT,
  company_email       TEXT,
  company_website     TEXT,
  primary_color       TEXT NOT NULL DEFAULT '#4338CA',
  secondary_color     TEXT NOT NULL DEFAULT '#6366F1',
  invoice_footer      TEXT DEFAULT 'Thank you for your business!',
  payment_terms       TEXT DEFAULT 'Payment due within 30 days of invoice date.',
  project_terms       TEXT,
  tax_id              TEXT,
  stripe_enabled      BOOLEAN DEFAULT FALSE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- If upgrading an existing table, add missing columns
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS secondary_color TEXT NOT NULL DEFAULT '#6366F1';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS project_terms TEXT;

-- Seed one default row if none exists
INSERT INTO app_settings (company_name)
SELECT 'WiredUP Rental Software'
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Stripe payment sessions — tracks generated payment links
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  session_id      TEXT UNIQUE NOT NULL,
  payment_url     TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

ALTER TABLE stripe_sessions DISABLE ROW LEVEL SECURITY;
