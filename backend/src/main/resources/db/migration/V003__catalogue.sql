CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    centre_lat NUMERIC(9,6) NOT NULL CHECK (centre_lat BETWEEN -90 AND 90),
    centre_lng NUMERIC(9,6) NOT NULL CHECK (centre_lng BETWEEN -180 AND 180),
    radius_m INTEGER NOT NULL CHECK (radius_m > 0),
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    slug VARCHAR(60) NOT NULL UNIQUE,
    business_name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    zone_id UUID NOT NULL REFERENCES zones(id),
    location_text VARCHAR(200) NOT NULL,
    lat NUMERIC(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng NUMERIC(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
    payout_phone VARCHAR(16),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (status IN ('ONBOARDING','PENDING_REVIEW','ACTIVE','SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_merchants_public_zone ON merchants (zone_id, id) WHERE status = 'ACTIVE';

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    name VARCHAR(120) NOT NULL,
    unit VARCHAR(40),
    price_kes INTEGER NOT NULL CHECK (price_kes >= 0),
    in_stock BOOLEAN NOT NULL DEFAULT true,
    photo_key TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_products_merchant ON products (merchant_id, id) WHERE deleted_at IS NULL;
CREATE INDEX ix_products_public_name ON products (lower(name)) WHERE deleted_at IS NULL AND in_stock;
