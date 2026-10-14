CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(16) NOT NULL CHECK (role IN ('MERCHANT', 'RIDER')),
    phone VARCHAR(16) NOT NULL UNIQUE,
    display_name VARCHAR(120),
    language VARCHAR(5) NOT NULL DEFAULT 'sw',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(16) NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('MERCHANT', 'RIDER')),
    purpose VARCHAR(16) NOT NULL DEFAULT 'LOGIN' CHECK (purpose = 'LOGIN'),
    code_hmac BYTEA NOT NULL,
    channel VARCHAR(8) NOT NULL DEFAULT 'SMS' CHECK (channel = 'SMS'),
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts SMALLINT NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    requested_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX otp_challenges_phone_created_idx ON otp_challenges (phone, created_at DESC);
CREATE INDEX otp_challenges_expiry_idx ON otp_challenges (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_hash BYTEA NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    family_expires_at TIMESTAMPTZ NOT NULL,
    rotated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_ip INET,
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
