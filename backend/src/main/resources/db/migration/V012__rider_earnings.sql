ALTER TABLE wallet_accounts
    DROP CONSTRAINT ck_wallet_accounts_type,
    DROP CONSTRAINT ck_wallet_accounts_owner;

ALTER TABLE wallet_accounts
    ADD CONSTRAINT ck_wallet_accounts_type
        CHECK (account_type IN (
            'MERCHANT_AVAILABLE',
            'RIDER_AVAILABLE',
            'PLATFORM_REVENUE',
            'CUSTOMER_FUNDS',
            'PAYMENT_CLEARING',
            'PAYOUT_CLEARING'
        )),
    ADD CONSTRAINT ck_wallet_accounts_owner
        CHECK (
            (account_type IN ('MERCHANT_AVAILABLE', 'RIDER_AVAILABLE') AND owner_user_id IS NOT NULL)
            OR (account_type IN (
                'PLATFORM_REVENUE',
                'CUSTOMER_FUNDS',
                'PAYMENT_CLEARING',
                'PAYOUT_CLEARING'
            ) AND owner_user_id IS NULL)
        );

ALTER TABLE ledger_transactions
    DROP CONSTRAINT ck_ledger_transactions_reference_type,
    ADD CONSTRAINT ck_ledger_transactions_reference_type
        CHECK (reference_type IN (
            'PAYMENT',
            'DELIVERY',
            'RIDER_DELIVERY',
            'REFUND',
            'WITHDRAWAL'
        ));

INSERT INTO wallet_accounts (owner_user_id, account_type)
SELECT DISTINCT d.rider_user_id, 'RIDER_AVAILABLE'
  FROM deliveries d
  JOIN users u ON u.id = d.rider_user_id AND u.role = 'RIDER'
  JOIN baskets b ON b.id = d.basket_id
 WHERE d.status = 'DELIVERED'
   AND d.rider_user_id IS NOT NULL
   AND b.delivery_fee_kes > 0
ON CONFLICT (owner_user_id) DO NOTHING;

INSERT INTO wallet_accounts (owner_user_id, account_type)
VALUES (NULL, 'CUSTOMER_FUNDS'), (NULL, 'PLATFORM_REVENUE')
ON CONFLICT DO NOTHING;

INSERT INTO ledger_transactions (reference_type, reference_id, description, created_at)
SELECT 'RIDER_DELIVERY',
       d.id,
       'Rider earnings after verified delivery',
       COALESCE(d.delivered_at, d.updated_at)
  FROM deliveries d
  JOIN baskets b ON b.id = d.basket_id
 WHERE d.status = 'DELIVERED'
   AND d.rider_user_id IS NOT NULL
   AND b.delivery_fee_kes > 0
ON CONFLICT (reference_type, reference_id) DO NOTHING;

INSERT INTO ledger_entries (transaction_id, account_id, amount_kes, created_at)
SELECT lt.id, wa.id, -b.delivery_fee_kes, lt.created_at
  FROM ledger_transactions lt
  JOIN deliveries d ON d.id = lt.reference_id AND lt.reference_type = 'RIDER_DELIVERY'
  JOIN baskets b ON b.id = d.basket_id
  JOIN wallet_accounts wa
    ON wa.account_type = 'CUSTOMER_FUNDS' AND wa.owner_user_id IS NULL
 WHERE b.delivery_fee_kes > 0;

INSERT INTO ledger_entries (transaction_id, account_id, amount_kes, created_at)
SELECT lt.id,
       wa.id,
       b.delivery_fee_kes - ((b.delivery_fee_kes::BIGINT * 5 + 50) / 100),
       lt.created_at
  FROM ledger_transactions lt
  JOIN deliveries d ON d.id = lt.reference_id AND lt.reference_type = 'RIDER_DELIVERY'
  JOIN baskets b ON b.id = d.basket_id
  JOIN wallet_accounts wa
    ON wa.account_type = 'RIDER_AVAILABLE' AND wa.owner_user_id = d.rider_user_id
 WHERE b.delivery_fee_kes > 0;

INSERT INTO ledger_entries (transaction_id, account_id, amount_kes, created_at)
SELECT lt.id,
       wa.id,
       (b.delivery_fee_kes::BIGINT * 5 + 50) / 100,
       lt.created_at
  FROM ledger_transactions lt
  JOIN deliveries d ON d.id = lt.reference_id AND lt.reference_type = 'RIDER_DELIVERY'
  JOIN baskets b ON b.id = d.basket_id
  JOIN wallet_accounts wa
    ON wa.account_type = 'PLATFORM_REVENUE' AND wa.owner_user_id IS NULL
 WHERE b.delivery_fee_kes > 0;
