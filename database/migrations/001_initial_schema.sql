-- LENDGUARD AI - Database Migration 001: Initial Schema
-- PostgreSQL 16 compatible DDL matching Blueprint Section 4

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role_is_active ON users (role, is_active);

-- 2. import_batches
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_reference VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(20) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(128) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_import_batches_source_status_created ON import_batches (source_type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_import_batches_uploaded_by ON import_batches (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_import_batches_file_hash ON import_batches (file_hash);

-- 3. transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    source_row_number INTEGER NOT NULL,
    transaction_reference VARCHAR(150) NOT NULL,
    external_reference VARCHAR(150) NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    transaction_type VARCHAR(50) NULL,
    source_type VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    raw_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_transactions_batch_row UNIQUE (import_batch_id, source_row_number)
);

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions (transaction_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_external_ref ON transactions (external_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_batch_id ON transactions (import_batch_id);

-- 4. import_row_errors
CREATE TABLE IF NOT EXISTS import_row_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    field_name VARCHAR(100) NULL,
    error_code VARCHAR(60) NOT NULL,
    error_message TEXT NOT NULL,
    raw_row JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_import_row_errors_batch_row ON import_row_errors (import_batch_id, row_number);

-- 5. reconciliation_runs
CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internal_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE RESTRICT,
    external_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL,
    total_internal INTEGER NOT NULL DEFAULT 0,
    total_external INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    exception_count INTEGER NOT NULL DEFAULT 0,
    started_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    rule_version VARCHAR(40) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    failure_code VARCHAR(60) NULL,
    failure_message TEXT NULL,
    CONSTRAINT chk_recon_runs_diff_batches CHECK (internal_batch_id <> external_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_recon_runs_status_started ON reconciliation_runs (status, started_at);
CREATE INDEX IF NOT EXISTS idx_recon_runs_batch_pair ON reconciliation_runs (internal_batch_id, external_batch_id);

-- 6. reconciliation_matches
CREATE TABLE IF NOT EXISTS reconciliation_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    match_type VARCHAR(30) NOT NULL,
    confidence NUMERIC(5,2) NULL,
    evidence JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_matches_run_id ON reconciliation_matches (reconciliation_run_id);

-- 7. reconciliation_match_items
CREATE TABLE IF NOT EXISTS reconciliation_match_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_match_id UUID NOT NULL REFERENCES reconciliation_matches(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    side VARCHAR(10) NOT NULL CHECK (side IN ('INTERNAL', 'EXTERNAL')),
    amount_applied NUMERIC(18,2) NOT NULL CHECK (amount_applied > 0),
    CONSTRAINT uq_recon_match_items UNIQUE (reconciliation_match_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_recon_match_items_txn_id ON reconciliation_match_items (transaction_id);

-- 8. exceptions
CREATE TABLE IF NOT EXISTS exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    internal_transaction_id UUID NULL REFERENCES transactions(id) ON DELETE SET NULL,
    external_transaction_id UUID NULL REFERENCES transactions(id) ON DELETE SET NULL,
    exception_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    expected_amount NUMERIC(18,2) NULL,
    actual_amount NUMERIC(18,2) NULL,
    discrepancy_amount NUMERIC(18,2) NULL,
    assigned_to UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    resolution_category VARCHAR(60) NULL,
    resolution_explanation TEXT NULL,
    resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_exceptions_status_severity ON exceptions (status, severity);
CREATE INDEX IF NOT EXISTS idx_exceptions_assigned_status ON exceptions (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_exceptions_run_id ON exceptions (reconciliation_run_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_type ON exceptions (exception_type);

-- 9. password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_expires ON password_reset_tokens (user_id, expires_at);

-- 10. investigation_notes
CREATE TABLE IF NOT EXISTS investigation_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exception_id UUID NOT NULL REFERENCES exceptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_exception_created ON investigation_notes (exception_id, created_at);

-- 11. ai_analyses
CREATE TABLE IF NOT EXISTS ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exception_id UUID NOT NULL REFERENCES exceptions(id) ON DELETE CASCADE,
    analysis_type VARCHAR(30) NOT NULL,
    model_name VARCHAR(100) NULL,
    model_version VARCHAR(100) NULL,
    result JSONB NULL,
    status VARCHAR(30) NOT NULL,
    failure_code VARCHAR(60) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_exception_created ON ai_analyses (exception_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_status ON ai_analyses (status);

-- 12. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NULL,
    details JSONB NOT NULL DEFAULT '{}',
    correlation_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

-- 13. background_jobs
CREATE TABLE IF NOT EXISTS background_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ NULL,
    locked_by VARCHAR(100) NULL,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status_available ON background_jobs (status, available_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status ON background_jobs (job_type, status);
