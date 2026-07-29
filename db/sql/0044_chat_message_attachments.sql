-- 0044_chat_message_attachments.sql
-- T-073: adds attachment_url/attachment_type to messages so the chat GIF/
-- sticker drawer can persist a selection as a real message, mirroring how
-- posts already carry gif_url. content stays NOT NULL; an attachment-only
-- message sends '' for content rather than relaxing the constraint.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT
    CHECK (attachment_type IS NULL OR attachment_type IN ('gif', 'sticker'));

COMMENT ON COLUMN messages.attachment_url  IS 'KLIPY-hosted GIF/sticker URL attached to this message, if any';
COMMENT ON COLUMN messages.attachment_type IS 'Attachment kind: gif or sticker; null for a plain text message';
