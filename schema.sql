-- Link Checker Database Schema

CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    expected_status INTEGER DEFAULT 200,
    timeout_ms INTEGER DEFAULT 10000,
    follow_redirects BOOLEAN DEFAULT 1,
    check_interval_seconds INTEGER DEFAULT 300,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    status_code INTEGER,
    response_time_ms INTEGER,
    error TEXT,
    redirect_chain TEXT, -- JSON array of redirect URLs
    ssl_expiry DATETIME,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checks_target_id ON checks(target_id);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_targets_enabled ON targets(enabled);

-- View for latest check per target
CREATE VIEW IF NOT EXISTS latest_checks AS
SELECT 
    t.id as target_id,
    t.url,
    t.name,
    t.expected_status,
    t.check_interval_seconds,
    t.enabled,
    c.status_code,
    c.response_time_ms,
    c.error,
    c.redirect_chain,
    c.ssl_expiry,
    c.checked_at
FROM targets t
LEFT JOIN (
    SELECT target_id, status_code, response_time_ms, error, redirect_chain, ssl_expiry, checked_at,
           ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY checked_at DESC) as rn
    FROM checks
) c ON t.id = c.target_id AND c.rn = 1;