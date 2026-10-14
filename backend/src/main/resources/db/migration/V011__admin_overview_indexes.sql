CREATE INDEX ix_baskets_created_at
    ON baskets (created_at);

CREATE INDEX ix_payments_succeeded_completed_at
    ON payments (completed_at)
    WHERE status = 'SUCCEEDED';

CREATE INDEX ix_payments_review
    ON payments (id)
    WHERE status = 'REVIEW';

CREATE INDEX ix_deliveries_delivered_at
    ON deliveries (delivered_at)
    WHERE status = 'DELIVERED';

CREATE INDEX ix_deliveries_failed
    ON deliveries (id)
    WHERE status = 'FAILED';

CREATE INDEX ix_merchants_pending_review
    ON merchants (created_at, user_id)
    WHERE status = 'PENDING_REVIEW';

CREATE INDEX ix_rider_profiles_pending
    ON rider_profiles (user_id)
    WHERE approval_status = 'PENDING';

CREATE INDEX ix_payment_callback_inbox_review
    ON payment_callback_inbox (id)
    WHERE status = 'REVIEW';
