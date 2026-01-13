-- Add shortcut tracking tables for iOS/Android SMS forwarding setup
-- Created: 2026-01-12

-- Store iCloud shortcut link and version info
CREATE TABLE IF NOT EXISTS shortcut_config (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  shortcut_url TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track user shortcut downloads and setup completion
CREATE TABLE IF NOT EXISTS shortcut_downloads (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  clicked_at TIMESTAMP DEFAULT NOW(),
  completed_setup BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  first_sms_received_at TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_shortcut_downloads_user ON shortcut_downloads(user_email);
CREATE INDEX IF NOT EXISTS idx_shortcut_downloads_completed ON shortcut_downloads(completed_setup);
CREATE INDEX IF NOT EXISTS idx_shortcut_downloads_platform ON shortcut_downloads(platform);

-- Insert the iOS iCloud shortcut link
INSERT INTO shortcut_config (platform, shortcut_url, version)
VALUES ('ios', 'https://www.icloud.com/shortcuts/7639447cb0e44558b4e611237a408184', '1.0')
ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE shortcut_config IS 'Stores shareable shortcut links for iOS and Android SMS forwarding setup';
COMMENT ON TABLE shortcut_downloads IS 'Tracks user engagement with shortcut setup flow for analytics';
