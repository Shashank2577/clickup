-- Migration: doc_snapshots table for Y.js state persistence
CREATE TABLE IF NOT EXISTS doc_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        UUID NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  state_vector  BYTEA NOT NULL,    -- Y.js encoded state vector (Uint8Array)
  update_data   BYTEA NOT NULL,    -- Y.js encoded document update (Uint8Array)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the latest snapshot matters per doc; index for fast lookup
CREATE INDEX IF NOT EXISTS idx_doc_snapshots_doc_created
  ON doc_snapshots (doc_id, created_at DESC);
