ALTER TABLE merchants
    DROP CONSTRAINT merchants_status_check,
    ADD CONSTRAINT ck_merchants_status
        CHECK (status IN ('ONBOARDING', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED'));
