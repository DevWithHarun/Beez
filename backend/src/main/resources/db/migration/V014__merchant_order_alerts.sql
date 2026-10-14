CREATE TABLE merchant_order_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_order_id UUID NOT NULL UNIQUE REFERENCES vendor_orders(id) ON DELETE CASCADE,
    merchant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    last_error_code VARCHAR(48),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((status = 'SENT') = (sent_at IS NOT NULL))
);

CREATE INDEX merchant_order_alerts_pending_idx
    ON merchant_order_alerts (next_attempt_at, created_at)
    WHERE status = 'PENDING';
