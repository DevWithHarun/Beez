ALTER TABLE vendor_orders
    ADD COLUMN ready_at TIMESTAMPTZ;

CREATE TABLE vendor_order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_order_id UUID NOT NULL REFERENCES vendor_orders(id),
    from_status VARCHAR(24) NOT NULL,
    to_status VARCHAR(24) NOT NULL,
    actor_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_vendor_order_events_order_created
    ON vendor_order_events (vendor_order_id, created_at DESC);

ALTER TABLE payment_callback_inbox
    ADD COLUMN claimed_at TIMESTAMPTZ;

ALTER TABLE payment_callback_inbox
    DROP CONSTRAINT payment_callback_inbox_status_check;

ALTER TABLE payment_callback_inbox
    ADD CONSTRAINT ck_payment_callback_inbox_status
    CHECK (status IN ('RECEIVED','RETRY','PROCESSING','PROCESSED','REVIEW'));
