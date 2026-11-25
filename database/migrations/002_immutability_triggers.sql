-- LENDGUARD AI - Database Migration 002: Audit and Note Immutability Triggers
-- Enforces append-only semantics for audit_logs and investigation_notes at the database engine level.

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs entries are immutable and cannot be updated or deleted (operation: %).', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

CREATE OR REPLACE FUNCTION prevent_investigation_note_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'investigation_notes entries are append-only and cannot be updated or deleted (operation: %).', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_investigation_notes_immutable ON investigation_notes;
CREATE TRIGGER trg_investigation_notes_immutable
BEFORE UPDATE OR DELETE ON investigation_notes
FOR EACH ROW
EXECUTE FUNCTION prevent_investigation_note_modification();
