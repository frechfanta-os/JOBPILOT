-- Migration: 0002_job_discovery.sql
-- Description: Extends job_listings table with status, source attribution, and summary; adds provider-level deduplication index.

ALTER TABLE job_listings ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXPIRED', 'UNKNOWN'));
ALTER TABLE job_listings ADD COLUMN source_attribution TEXT NOT NULL DEFAULT '';
ALTER TABLE job_listings ADD COLUMN description_summary TEXT;

-- Composite unique index preventing duplicate imports from the same provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_listings_provider_source ON job_listings(source_provider, source_id);

-- Additional indexes for country and remote job filtering
CREATE INDEX IF NOT EXISTS idx_job_listings_remote ON job_listings(country, is_remote);
CREATE INDEX IF NOT EXISTS idx_job_listings_published ON job_listings(published_at);
