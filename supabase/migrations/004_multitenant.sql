-- ============================================================
-- RigSync Multi-Tenant Migration
-- Each signup creates an isolated organization with its own
-- data, settings, and team members. Row-Level Security (RLS)
-- ensures complete data isolation between organizations.
-- ============================================================

-- ============================================================
-- 1. NEW TABLES: organizations + organization_members
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL DEFAULT 'My Company',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)   -- each user belongs to exactly one org
);

CREATE INDEX IF NOT EXISTS idx_org_members_user   ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org    ON public.organization_members(org_id);

-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================

-- Returns the org_id for the currently authenticated user.
-- Used in every RLS policy.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns true if the current user is the owner of their org.
CREATE OR REPLACE FUNCTION public.is_org_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;

-- ============================================================
-- 3. ADD org_id COLUMN TO ALL DATA TABLES
-- ============================================================

ALTER TABLE public.app_settings           ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.customers              ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.damage_reports         ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expenses               ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items        ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.kit_items              ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.kits                   ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.quote_items            ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.quotes                 ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.rental_bookings        ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.stripe_sessions        ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.terms_templates        ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 4. TRIGGER: auto-set org_id on INSERT for all data tables
-- The trigger fires BEFORE INSERT, sets org_id from the
-- current user's membership. Works for authenticated writes.
-- Service-role inserts (webhook, callbacks) must set org_id
-- explicitly since they have no auth session.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_org_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.get_user_org_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER set_org_id_app_settings           BEFORE INSERT ON public.app_settings           FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_customers              BEFORE INSERT ON public.customers              FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_damage_reports         BEFORE INSERT ON public.damage_reports         FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_expenses               BEFORE INSERT ON public.expenses               FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_financial_transactions BEFORE INSERT ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_inventory_items        BEFORE INSERT ON public.inventory_items        FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_kit_items              BEFORE INSERT ON public.kit_items              FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_kits                   BEFORE INSERT ON public.kits                   FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_quote_items            BEFORE INSERT ON public.quote_items            FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_quotes                 BEFORE INSERT ON public.quotes                 FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_rental_bookings        BEFORE INSERT ON public.rental_bookings        FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_stripe_sessions        BEFORE INSERT ON public.stripe_sessions        FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
CREATE OR REPLACE TRIGGER set_org_id_terms_templates        BEFORE INSERT ON public.terms_templates        FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_templates        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- organizations: members can read their org; owners can update
CREATE POLICY "org_select"  ON public.organizations FOR SELECT USING (id = public.get_user_org_id());
CREATE POLICY "org_update"  ON public.organizations FOR UPDATE USING (id = public.get_user_org_id() AND public.is_org_owner());
-- INSERT/DELETE handled exclusively by service role (no policy = blocked for normal users)

-- organization_members: members can read who else is in their org
CREATE POLICY "members_select" ON public.organization_members FOR SELECT USING (org_id = public.get_user_org_id());
-- INSERT/DELETE/UPDATE handled exclusively by service role

-- Macro for data tables: read/write/delete scoped to org
-- INSERT uses WITH CHECK on the trigger-set org_id value.

-- app_settings
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "app_settings_insert" ON public.app_settings FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "app_settings_delete" ON public.app_settings FOR DELETE USING (org_id = public.get_user_org_id());

-- customers
CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (org_id = public.get_user_org_id());

-- damage_reports
CREATE POLICY "damage_reports_select" ON public.damage_reports FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "damage_reports_insert" ON public.damage_reports FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "damage_reports_update" ON public.damage_reports FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "damage_reports_delete" ON public.damage_reports FOR DELETE USING (org_id = public.get_user_org_id());

-- expenses
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE USING (org_id = public.get_user_org_id());

-- financial_transactions
CREATE POLICY "financial_transactions_select" ON public.financial_transactions FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "financial_transactions_insert" ON public.financial_transactions FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "financial_transactions_update" ON public.financial_transactions FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "financial_transactions_delete" ON public.financial_transactions FOR DELETE USING (org_id = public.get_user_org_id());

-- inventory_items
CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "inventory_items_insert" ON public.inventory_items FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "inventory_items_update" ON public.inventory_items FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "inventory_items_delete" ON public.inventory_items FOR DELETE USING (org_id = public.get_user_org_id());

-- kit_items
CREATE POLICY "kit_items_select" ON public.kit_items FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "kit_items_insert" ON public.kit_items FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "kit_items_update" ON public.kit_items FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "kit_items_delete" ON public.kit_items FOR DELETE USING (org_id = public.get_user_org_id());

-- kits
CREATE POLICY "kits_select" ON public.kits FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "kits_insert" ON public.kits FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "kits_update" ON public.kits FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "kits_delete" ON public.kits FOR DELETE USING (org_id = public.get_user_org_id());

-- quote_items
CREATE POLICY "quote_items_select" ON public.quote_items FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "quote_items_insert" ON public.quote_items FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "quote_items_update" ON public.quote_items FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "quote_items_delete" ON public.quote_items FOR DELETE USING (org_id = public.get_user_org_id());

-- quotes
CREATE POLICY "quotes_select" ON public.quotes FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "quotes_insert" ON public.quotes FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "quotes_update" ON public.quotes FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "quotes_delete" ON public.quotes FOR DELETE USING (org_id = public.get_user_org_id());

-- rental_bookings
CREATE POLICY "rental_bookings_select" ON public.rental_bookings FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "rental_bookings_insert" ON public.rental_bookings FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "rental_bookings_update" ON public.rental_bookings FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "rental_bookings_delete" ON public.rental_bookings FOR DELETE USING (org_id = public.get_user_org_id());

-- stripe_sessions (webhook uses service role, bypasses RLS automatically)
CREATE POLICY "stripe_sessions_select" ON public.stripe_sessions FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "stripe_sessions_insert" ON public.stripe_sessions FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "stripe_sessions_update" ON public.stripe_sessions FOR UPDATE USING (org_id = public.get_user_org_id());

-- terms_templates
CREATE POLICY "terms_templates_select" ON public.terms_templates FOR SELECT USING (org_id = public.get_user_org_id());
CREATE POLICY "terms_templates_insert" ON public.terms_templates FOR INSERT WITH CHECK (org_id = public.get_user_org_id());
CREATE POLICY "terms_templates_update" ON public.terms_templates FOR UPDATE USING (org_id = public.get_user_org_id());
CREATE POLICY "terms_templates_delete" ON public.terms_templates FOR DELETE USING (org_id = public.get_user_org_id());

-- ============================================================
-- 7. MIGRATE EXISTING DATA
-- Creates a default org and assigns all existing rows to it.
-- After running, you MUST run the follow-up snippet below to
-- add your existing user account as the org owner.
-- ============================================================

DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Create the default org for existing data
  INSERT INTO public.organizations (name)
  VALUES ('My Company')
  RETURNING id INTO default_org_id;

  -- Assign every existing row to this org
  UPDATE public.app_settings           SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.customers              SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.damage_reports         SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.expenses               SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.financial_transactions SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.inventory_items        SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.kit_items              SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.kits                   SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.quote_items            SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.quotes                 SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.rental_bookings        SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.stripe_sessions        SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.terms_templates        SET org_id = default_org_id WHERE org_id IS NULL;

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Default org created: %', default_org_id;
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEP — run this to add yourself as owner:';
  RAISE NOTICE '';
  RAISE NOTICE 'INSERT INTO public.organization_members (org_id, user_id, role)';
  RAISE NOTICE 'VALUES (''%'', ''<YOUR_USER_ID_FROM_AUTH_USERS>'', ''owner'');', default_org_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Find your user ID in: Supabase → Authentication → Users';
  RAISE NOTICE '=================================================';
END $$;
