ALTER TABLE vendor_orders
    ADD COLUMN paid_at TIMESTAMPTZ;

ALTER TABLE payments
    DROP CONSTRAINT payments_status_check;

ALTER TABLE payments
    ADD CONSTRAINT ck_payments_status
    CHECK (status IN ('INITIATED','PENDING','SUCCEEDED','FAILED','TIMEOUT','REVIEW'));

CREATE TABLE payment_callback_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_request_id VARCHAR(64) NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'
        CHECK (status IN ('RECEIVED','RETRY','PROCESSED','REVIEW')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX ix_payment_callback_inbox_pending
    ON payment_callback_inbox (received_at)
    WHERE status IN ('RECEIVED','RETRY');

CREATE INDEX ix_vendor_orders_paid_at
    ON vendor_orders (merchant_id, paid_at DESC)
    WHERE paid_at IS NOT NULL;
