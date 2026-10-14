ALTER TABLE wallet_accounts
    DROP CONSTRAINT wallet_accounts_account_type_check,
    DROP CONSTRAINT wallet_accounts_check;

ALTER TABLE wallet_accounts
    ADD CONSTRAINT ck_wallet_accounts_type
        CHECK (account_type IN (
            'MERCHANT_AVAILABLE',
            'PLATFORM_REVENUE',
            'CUSTOMER_FUNDS',
            'PAYMENT_CLEARING',
            'PAYOUT_CLEARING'
        )),
    ADD CONSTRAINT ck_wallet_accounts_owner
        CHECK (
            (account_type = 'MERCHANT_AVAILABLE' AND owner_user_id IS NOT NULL)
            OR (account_type IN (
                'PLATFORM_REVENUE',
                'CUSTOMER_FUNDS',
                'PAYMENT_CLEARING',
                'PAYOUT_CLEARING'
            ) AND owner_user_id IS NULL)
        );

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ledger_transactions_reference_type_check,
    ADD CONSTRAINT ck_ledger_transactions_reference_type
        CHECK (reference_type IN ('PAYMENT', 'DELIVERY', 'REFUND', 'WITHDRAWAL'));

CREATE TABLE merchant_withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_user_id UUID NOT NULL REFERENCES users(id),
    amount_kes BIGINT NOT NULL CHECK (amount_kes > 0),
    payout_phone VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'REQUESTED'
        CHECK (status IN ('REQUESTED', 'PROCESSING', 'PAID', 'REJECTED')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processing_at TIMESTAMPTZ,
    processing_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    provider_reference VARCHAR(64),
    resolution_note VARCHAR(240),
    CHECK (
        (status = 'REQUESTED' AND processing_at IS NULL AND resolved_at IS NULL)
        OR (status = 'PROCESSING' AND processing_at IS NOT NULL AND resolved_at IS NULL)
        OR (status IN ('PAID', 'REJECTED') AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX ix_merchant_withdrawals_pending
    ON merchant_withdrawal_requests (requested_at, id)
    WHERE status IN ('REQUESTED', 'PROCESSING');

CREATE INDEX ix_merchant_withdrawals_user
    ON merchant_withdrawal_requests (merchant_user_id, requested_at DESC, id DESC);

CREATE UNIQUE INDEX ux_merchant_withdrawals_provider_reference
    ON merchant_withdrawal_requests (provider_reference)
    WHERE provider_reference IS NOT NULL;
