-- ============================================================
-- Terms Templates — reusable payment terms & project T&C
-- ============================================================
CREATE TABLE IF NOT EXISTS terms_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('payment_terms', 'project_terms')),
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_default  BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE terms_templates DISABLE ROW LEVEL SECURITY;

-- Seed default payment terms
INSERT INTO terms_templates (type, name, body, is_default, sort_order) VALUES
  ('payment_terms', 'Due on Receipt',     'Payment is due upon receipt of this invoice.', FALSE, 1),
  ('payment_terms', 'Net 15',             'Payment due within 15 days of invoice date.', FALSE, 2),
  ('payment_terms', 'Net 30',             'Payment due within 30 days of invoice date.', TRUE,  3),
  ('payment_terms', 'Net 45',             'Payment due within 45 days of invoice date.', FALSE, 4),
  ('payment_terms', '50% Deposit',        '50% deposit required to confirm booking. Remaining balance due 7 days before event date.', FALSE, 5),
  ('payment_terms', '30-Day with Deposit','25% non-refundable deposit due at booking. Balance due within 30 days of invoice date.', FALSE, 6),
  ('project_terms', 'Standard Rental Agreement',
   E'RENTAL TERMS & CONDITIONS\n\n1. Equipment Responsibility: Client assumes full responsibility for all rented equipment from time of delivery/pickup until return. Client is liable for any loss, theft, or damage beyond normal wear.\n\n2. Cancellation Policy: Cancellations made 14+ days prior to event: full refund of deposit. 7–13 days prior: 50% of deposit retained. Less than 7 days: deposit is non-refundable.\n\n3. Equipment Use: Equipment shall be used only for its intended purpose and by qualified personnel. No modifications, subletting, or unauthorized use permitted.\n\n4. Force Majeure: Neither party shall be liable for delays or failures due to acts of God, weather events, or other circumstances beyond reasonable control.\n\n5. Governing Law: This agreement shall be governed by the laws of the state in which services are rendered.',
   TRUE, 1),
  ('project_terms', 'Event Production Terms',
   E'PRODUCTION AGREEMENT TERMS\n\n1. Setup & Teardown: Client agrees to provide adequate access time for setup (minimum 2 hours) and teardown (minimum 1 hour) at no additional charge unless otherwise noted.\n\n2. Damage & Loss: Client is responsible for all equipment from delivery to pickup. Damaged equipment will be billed at repair cost; total loss billed at replacement value.\n\n3. Cancellation: Events cancelled within 72 hours of start time forfeit 100% of quoted amount. Events cancelled 4–7 days prior forfeit 50% of quoted amount.\n\n4. Power & Access: Client is responsible for ensuring adequate power supply (20A per circuit minimum) and safe venue access for all equipment.\n\n5. Intellectual Property: Any recordings or broadcasts using rented equipment remain the sole property of the client, provided all fees are paid in full.',
   FALSE, 2),
  ('project_terms', 'Simple Agreement',
   'All rented equipment must be returned in the same condition as delivered. Client is responsible for any damage or loss. A 50% deposit is required to secure your booking. The remaining balance is due on or before the event date. Late returns may be subject to additional daily charges.',
   FALSE, 3);

-- Add per-quote terms columns
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms_text TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_terms_text TEXT;
