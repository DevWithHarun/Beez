ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('MERCHANT', 'RIDER', 'ADMIN'));

CREATE TABLE admin_accounts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash VARCHAR(100) NOT NULL,
    totp_secret_encrypted BYTEA NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    failed_login_count SMALLINT NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until TIMESTAMPTZ,
    last_totp_step BIGINT NOT NULL DEFAULT -1,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES admin_accounts(user_id),
    attempted_email VARCHAR(254) NOT NULL,
    succeeded BOOLEAN NOT NULL,
    remote_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_admin_auth_events_email_created
    ON admin_auth_events (attempted_email, created_at DESC);

CREATE TABLE admin_bootstrap_lock (
    id SMALLINT PRIMARY KEY CHECK (id = 1)
);

INSERT INTO admin_bootstrap_lock (id) VALUES (1);
