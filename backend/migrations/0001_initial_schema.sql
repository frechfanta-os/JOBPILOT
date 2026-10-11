-- Migration: 0001_initial_schema.sql
-- Description: Core schema for JobPilot International (Users, CV Documents, Job Listings, Match Assessments, Applications, Communications)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    target_countries TEXT NOT NULL, -- JSON array ['CA', 'IT']
    primary_language TEXT NOT NULL DEFAULT 'en',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS cv_documents (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_format TEXT NOT NULL CHECK(file_format IN ('PDF', 'DOCX')),
    r2_storage_key TEXT NOT NULL,
    sha256_checksum TEXT NOT NULL,
    target_country TEXT NOT NULL CHECK(target_country IN ('CA', 'IT', 'ALL')),
    language TEXT NOT NULL CHECK(language IN ('en', 'fr', 'it')),
    is_base_profile INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_cv_documents_user ON cv_documents(user_id);

CREATE TABLE IF NOT EXISTS job_listings (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL,
    source_provider TEXT NOT NULL,
    title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    country TEXT NOT NULL CHECK(country IN ('CA', 'IT')),
    city TEXT NOT NULL,
    province_or_region TEXT NOT NULL,
    is_remote INTEGER NOT NULL DEFAULT 0,
    contract_type TEXT NOT NULL,
    salary_min INTEGER,
    salary_max INTEGER,
    currency TEXT NOT NULL CHECK(currency IN ('CAD', 'EUR')),
    description_raw TEXT NOT NULL,
    required_languages TEXT NOT NULL, -- JSON array
    required_skills TEXT NOT NULL,    -- JSON array
    source_url TEXT NOT NULL,
    application_url TEXT,
    content_hash TEXT UNIQUE NOT NULL, -- Anti-duplicate hash
    published_at TEXT,
    retrieved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_job_listings_country ON job_listings(country, city);
CREATE INDEX IF NOT EXISTS idx_job_listings_source ON job_listings(source_provider, source_id);

CREATE TABLE IF NOT EXISTS match_assessments (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK(overall_score BETWEEN 0 AND 100),
    skills_score INTEGER NOT NULL,
    experience_score INTEGER NOT NULL,
    language_score INTEGER NOT NULL,
    authorization_compatibility TEXT NOT NULL,
    matched_skills TEXT NOT NULL,     -- JSON array
    missing_skills TEXT NOT NULL,     -- JSON array
    risk_factors TEXT NOT NULL,       -- JSON array
    recommended_actions TEXT NOT NULL,-- JSON array
    assessment_model TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_user_job_match UNIQUE (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS application_records (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    current_state TEXT NOT NULL CHECK(current_state IN (
        'DISCOVERED','ANALYZED','READY_FOR_REVIEW','APPROVED',
        'SUBMISSION_PENDING','SUBMITTED','FAILED','WITHDRAWN','CLOSED'
    )),
    tailored_cv_id TEXT REFERENCES cv_documents(id),
    cover_letter_text TEXT,
    submission_method TEXT NOT NULL CHECK(submission_method IN ('MANUAL_ASSISTED','OFFICIAL_API')),
    idempotency_key TEXT UNIQUE NOT NULL,
    submitted_at TEXT,
    last_activity_at TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_user_job_app UNIQUE (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_state ON application_records(user_id, current_state);

CREATE TABLE IF NOT EXISTS email_communications (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id TEXT REFERENCES application_records(id) ON DELETE SET NULL,
    gmail_message_id TEXT UNIQUE NOT NULL,
    gmail_thread_id TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    snippet TEXT NOT NULL,
    classification TEXT NOT NULL CHECK(classification IN (
        'CONFIRMATION','INTERVIEW_INVITATION','INFO_REQUEST','REJECTION','OFFER','GENERAL'
    )),
    confidence_score REAL NOT NULL,
    action_required INTEGER NOT NULL DEFAULT 0,
    suggested_action TEXT,
    received_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_email_app ON email_communications(application_id);
