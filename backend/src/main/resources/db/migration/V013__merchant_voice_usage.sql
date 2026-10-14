CREATE TABLE merchant_voice_usage (
    merchant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hour_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 10),
    audio_bytes BIGINT NOT NULL CHECK (audio_bytes BETWEEN 1 AND 52428800),
    PRIMARY KEY (merchant_user_id, hour_start)
);

CREATE INDEX merchant_voice_usage_hour_start_idx ON merchant_voice_usage(hour_start);
