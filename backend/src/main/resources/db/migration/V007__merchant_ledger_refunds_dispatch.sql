CREATE TABLE rider_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    approval_status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'SUSPENDED')),
    available BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO rider_profiles (user_id)
SELECT id FROM users WHERE role = 'RIDER'
ON CONFLICT (user_id) DO NOTHING;

CREATE FUNCTION create_rider_profile()
RETURNS trigger AS $$
BEGIN
    IF NEW.role = 'RIDER' THEN
        INSERT INTO rider_profiles (user_id) VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_create_rider_profile
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_rider_profile();

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_id UUID NOT NULL UNIQUE REFERENCES baskets(id),
    rider_user_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING_READY'
        CHECK (status IN ('WAITING_READY', 'AVAILABLE', 'CLAIMED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'FAILED')),
    claim_deadline TIMESTAMPTZ,
    failed_code_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_code_attempts >= 0),
    code_locked BOOLEAN NOT NULL DEFAULT false,
    claimed_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_deliveries_available ON deliveries (created_at, id)
    WHERE status = 'AVAILABLE';
CREATE INDEX ix_deliveries_rider_active ON deliveries (rider_user_id, status)
    WHERE rider_user_id IS NOT NULL;

CREATE TABLE delivery_code_secrets (
    basket_id UUID PRIMARY KEY REFERENCES baskets(id) ON DELETE CASCADE,
    code_hash BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id),
    actor_user_id UUID REFERENCES users(id),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    detail VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_delivery_events_delivery_created
    ON delivery_events (delivery_id, created_at DESC);

CREATE TABLE delivery_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id),
    vendor_order_id UUID NOT NULL UNIQUE REFERENCES vendor_orders(id),
    stop_number SMALLINT NOT NULL CHECK (stop_number > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PICKED_UP', 'SKIPPED')),
    picked_up_at TIMESTAMPTZ,
    UNIQUE (delivery_id, stop_number)
);

CREATE TABLE wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID UNIQUE REFERENCES users(id),
    account_type VARCHAR(20) NOT NULL
        CHECK (account_type IN ('MERCHANT_AVAILABLE', 'PLATFORM_REVENUE', 'CUSTOMER_FUNDS', 'PAYMENT_CLEARING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (account_type = 'MERCHANT_AVAILABLE' AND owner_user_id IS NOT NULL)
        OR (account_type IN ('PLATFORM_REVENUE', 'CUSTOMER_FUNDS', 'PAYMENT_CLEARING')
            AND owner_user_id IS NULL)
    )
);

CREATE UNIQUE INDEX ux_wallet_system_account
    ON wallet_accounts (account_type)
    WHERE owner_user_id IS NULL;

CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_type VARCHAR(24) NOT NULL CHECK (reference_type IN ('PAYMENT', 'DELIVERY', 'REFUND')),
    reference_id UUID NOT NULL,
    description VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (reference_type, reference_id)
);

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES ledger_transactions(id),
    account_id UUID NOT NULL REFERENCES wallet_accounts(id),
    amount_kes BIGINT NOT NULL CHECK (amount_kes <> 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_ledger_entries_account_created
    ON ledger_entries (account_id, created_at DESC, id DESC);

CREATE FUNCTION enforce_balanced_ledger_transaction()
RETURNS trigger AS $$
DECLARE
    transaction_id UUID;
    total BIGINT;
BEGIN
    transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
    SELECT COALESCE(SUM(amount_kes), 0) INTO total
      FROM ledger_entries WHERE ledger_entries.transaction_id = transaction_id;
    IF total <> 0 THEN
        RAISE EXCEPTION 'Ledger transaction % is not balanced', transaction_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction();

CREATE TABLE merchant_refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_order_id UUID NOT NULL UNIQUE REFERENCES vendor_orders(id),
    merchant_user_id UUID NOT NULL REFERENCES users(id),
    amount_kes INTEGER NOT NULL CHECK (amount_kes > 0),
    reason VARCHAR(240) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    provider_reference VARCHAR(64),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_note VARCHAR(240)
);

CREATE INDEX ix_merchant_refund_requests_pending
    ON merchant_refund_requests (requested_at)
    WHERE status = 'PENDING';

CREATE TABLE operations_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(48) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    detail VARCHAR(240) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
