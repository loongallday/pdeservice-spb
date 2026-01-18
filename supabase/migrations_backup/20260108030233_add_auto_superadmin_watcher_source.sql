-- Add auto_superadmin to watcher_source enum
-- This allows superadmins to be automatically added as watchers when tickets are created

ALTER TYPE watcher_source ADD VALUE IF NOT EXISTS 'auto_superadmin';
