-- Migration: 0003_match_and_tailored_docs.sql
-- Description: Adds full structured profile storage, extends match_assessments with explainability & versioning, and creates tailored_documents table.

-- 1. Full confirmed profile storage in users
ALTER TABLE users ADD COLUMN profile_data TEXT;

-- 2. Extend match_assessments with criteria weights, education/location scores, evidence, and versioning
ALTER TABLE match_assessments ADD COLUMN education_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_assessments ADD COLUMN location_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_assessments ADD COLUMN criteria_weights TEXT NOT NULL DEFAULT '{}';
ALTER TABLE match_assessments ADD COLUMN matching_evidence TEXT NOT NULL DEFAULT '[]';
ALTER TABLE match_assessments ADD COLUMN unverified_requirements TEXT NOT NULL DEFAULT '[]';
ALTER TABLE match_assessments ADD COLUMN scoring_version TEXT NOT NULL DEFAULT 'v1.0-deterministic';
ALTER TABLE match_assessments ADD COLUMN profile_updated_at TEXT;
ALTER TABLE match_assessments ADD COLUMN updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- 3. Dedicated table for job-tailored CVs and cover letters
CREATE TABLE IF NOT EXISTS tailored_documents (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK(document_type IN ('CV', 'COVER_LETTER')),
    language TEXT NOT NULL CHECK(language IN ('en', 'fr', 'it')),
    version_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'REVIEWED', 'APPROVED')) DEFAULT 'DRAFT',
    generation_model TEXT NOT NULL,
    generation_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_tailored_docs_user_job ON tailored_documents(user_id, job_id);
