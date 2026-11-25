-- 003_reconciliation_policies.sql
-- Persists institution-wide matching tolerance & AI threshold policy profiles

CREATE TABLE IF NOT EXISTS reconciliation_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id VARCHAR(30) NOT NULL DEFAULT 'strict',
    amount_tolerance_percent NUMERIC(8,4) NOT NULL DEFAULT 0.0000,
    fixed_rupee_tolerance NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    date_slippage_days INTEGER NOT NULL DEFAULT 0,
    fuzzy_reference_matching BOOLEAN NOT NULL DEFAULT TRUE,
    fuzzy_threshold INTEGER NOT NULL DEFAULT 85,
    auto_recon_confidence INTEGER NOT NULL DEFAULT 95,
    isolation_forest_outlier_threshold NUMERIC(5,2) NOT NULL DEFAULT 0.75,
    multi_currency_handling BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
