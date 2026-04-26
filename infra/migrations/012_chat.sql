-- ============================================================
-- MIGRATION 012 — Chat: channels, messages, reactions, DMs
-- ============================================================

-- ── Channel type enum ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
    CREATE TYPE channel_type AS ENUM ('public', 'private', 'direct');
  END IF;
END;
$$;

-- ── Message type enum ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_type') THEN
    CREATE TYPE chat_message_type AS ENUM ('text', 'system');
  END IF;
END;
$$;

-- ── Channels ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  space_id      UUID REFERENCES spaces(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  type          channel_type NOT NULL DEFAULT 'public',
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_channels_workspace ON channels (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channels_space ON channels (space_id) WHERE space_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels (workspace_id, type) WHERE deleted_at IS NULL;

-- ── Channel members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members (channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members (user_id);

-- ── Messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id        UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES users(id),
  content           TEXT NOT NULL,
  type              chat_message_type NOT NULL DEFAULT 'text',
  thread_parent_id  UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  reply_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages (channel_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages (thread_parent_id, created_at ASC) WHERE thread_parent_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages (sender_id) WHERE deleted_at IS NULL;

-- ── Message reactions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions (message_id);

-- ── Mentions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_mentions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_mentions_user ON chat_mentions (user_id);

-- ── Function to auto-increment reply_count ──────────────────
CREATE OR REPLACE FUNCTION update_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_parent_id IS NOT NULL THEN
    UPDATE chat_messages SET reply_count = reply_count + 1 WHERE id = NEW.thread_parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_message_reply_count ON chat_messages;
CREATE TRIGGER trg_chat_message_reply_count
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  WHEN (NEW.thread_parent_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_reply_count();
