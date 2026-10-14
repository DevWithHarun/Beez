ALTER TABLE merchants
    ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE merchants SET is_open = true WHERE status = 'ACTIVE';

CREATE INDEX ix_merchants_open_zone
    ON merchants (zone_id, id)
    WHERE status = 'ACTIVE' AND is_open = true;
