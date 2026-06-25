-- Migration: update hostels table to use single price + billing period,
-- and add caretaker/landlord info.
-- Usage: psql -U postgres -d hostelfinder -f migration_01_hostel_fields.sql

-- Add new columns
ALTER TABLE hostels ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE hostels ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE hostels ADD COLUMN IF NOT EXISTS caretaker_name VARCHAR(100);
ALTER TABLE hostels ADD COLUMN IF NOT EXISTS caretaker_phone VARCHAR(20);

-- Copy old price_min data into new price column (best-effort migration of existing data)
UPDATE hostels SET price = price_min WHERE price IS NULL AND price_min IS NOT NULL;

-- Drop old columns now that data is migrated
ALTER TABLE hostels DROP COLUMN IF EXISTS price_min;
ALTER TABLE hostels DROP COLUMN IF EXISTS price_max;