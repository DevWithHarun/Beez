CREATE SEQUENCE basket_number_seq START WITH 1001;

CREATE TABLE baskets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_no VARCHAR(20) NOT NULL UNIQUE,
    tracking_hash BYTEA NOT NULL UNIQUE,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    request_fingerprint BYTEA NOT NULL,
    zone_id UUID NOT NULL REFERENCES zones(id),
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(16) NOT NULL,
    delivery_lat NUMERIC(9,6) NOT NULL CHECK (delivery_lat BETWEEN -90 AND 90),
    delivery_lng NUMERIC(9,6) NOT NULL CHECK (delivery_lng BETWEEN -180 AND 180),
    delivery_landmark VARCHAR(200) NOT NULL,
    items_total_kes INTEGER NOT NULL CHECK (items_total_kes >= 0),
    delivery_fee_kes INTEGER NOT NULL CHECK (delivery_fee_kes >= 0),
    total_kes INTEGER NOT NULL CHECK (total_kes >= 0),
    request_ip_hash BYTEA NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING_PAYMENT'
        CHECK (status IN ('PENDING_PAYMENT','PAID','IN_PROGRESS','COMPLETED','CANCELLED','EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (total_kes = items_total_kes + delivery_fee_kes)
);

CREATE TABLE vendor_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_id UUID NOT NULL REFERENCES baskets(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    subtotal_kes INTEGER NOT NULL CHECK (subtotal_kes >= 0),
    status VARCHAR(24) NOT NULL DEFAULT 'AWAITING_PAYMENT'
        CHECK (status IN ('AWAITING_PAYMENT','PAID','READY','PICKED_UP','DELIVERED','REJECTED','CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (basket_id, merchant_id)
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_order_id UUID NOT NULL REFERENCES vendor_orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    name_snapshot VARCHAR(120) NOT NULL,
    unit_price_kes INTEGER NOT NULL CHECK (unit_price_kes >= 0),
    qty INTEGER NOT NULL CHECK (qty > 0),
    line_total_kes INTEGER NOT NULL CHECK (line_total_kes >= 0)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_id UUID NOT NULL REFERENCES baskets(id),
    provider VARCHAR(12) NOT NULL DEFAULT 'MPESA',
    amount_kes INTEGER NOT NULL CHECK (amount_kes > 0),
    phone VARCHAR(16) NOT NULL,
    merchant_request_id VARCHAR(64),
    checkout_request_id VARCHAR(64) UNIQUE,
    mpesa_receipt VARCHAR(20) UNIQUE,
    status VARCHAR(12) NOT NULL DEFAULT 'INITIATED'
        CHECK (status IN ('INITIATED','PENDING','SUCCEEDED','FAILED','TIMEOUT')),
    result_code INTEGER,
    result_desc VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX ix_payments_basket_created ON payments (basket_id, created_at DESC);

CREATE TABLE public_rate_limits (
    key_hash BYTEA PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0)
);
