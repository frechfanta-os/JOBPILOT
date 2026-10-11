# JOBPILOT INTERNATIONAL — MODULE CONTRACTS & SCHEMAS

> **Contract Version**: `v1.0.0-phase1-draft`  
> **Status**: Frozen for Phase 1 Review — Requires Approval Prior to Phase 2 Code Generation  
> **System Architecture**: Flutter Android Client + Cloudflare Workers / D1 / R2 Backend  
> **Package Identifier**: `com.ghdinteractivestudio.jobpilot`  
> **Author / Role**: Principal Software Architect  
> **Timestamp**: 2026-10-11T14:36:00Z  

---

## 1. Global Conventions & Standards

1. **Identifiers**: All entity IDs are standard RFC 4122 UUID v4 strings (e.g., `550e8400-e29b-41d4-a716-446655440000`).
2. **Timestamps**: All timestamps must be ISO 8601 strings in UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`). Database storage utilizes SQLite `INTEGER` (Unix epoch milliseconds) or UTC `TEXT`.
3. **Currencies**: Currencies are represented by three-letter ISO 4217 codes (`CAD`, `EUR`, `USD`). Salary amounts are stored as integer units (cents/cents of currency) or explicit min/max integer bounds.
4. **Localization Codes**: ISO 639-1 two-letter codes (`en`, `fr`, `it`).
5. **Feature Readiness Enums**: Every module, connector, and integration reports one of:
   `NOT_CONFIGURED` | `BLOCKED` | `READY` | `RUNNING` | `FAILED` | `DISABLED`
6. **Production Integrity Notice**: *A placeholder, mock, or interface must NEVER be represented as a working production integration. System components must truthfully report readiness.*

---

## 2. Core Domain Entities

### 2.1 User Profile & Structured CV (`UserProfile`)
```typescript
interface UserProfile {
  id: string; // UUID v4
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  target_countries: ('CA' | 'IT')[];
  primary_language: 'en' | 'fr' | 'it';
  work_authorization: {
    canada_status: 'CITIZEN' | 'PERMANENT_RESIDENT' | 'WORK_PERMIT' | 'NEED_SPONSORSHIP' | 'UNKNOWN';
    italy_status: 'CITIZEN' | 'EU_CITIZEN' | 'PERMESSO_DI_SOGGIORNO' | 'NEED_SPONSORSHIP' | 'UNKNOWN';
    verified_by_user: boolean;
  };
  skills: Array<{
    name: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
    years_of_experience: number;
    verified_from_cv: boolean;
  }>;
  experiences: Array<{
    id: string;
    company_name: string;
    job_title: string;
    location: string;
    start_date: string; // YYYY-MM
    end_date?: string;   // YYYY-MM or null for current
    is_current: boolean;
    description: string;
    technologies: string[];
  }>;
  education: Array<{
    id: string;
    institution: string;
    degree_name: string;
    field_of_study: string;
    graduation_year: number;
  }>;
  languages: Array<{
    code: 'en' | 'fr' | 'it' | string;
    proficiency: 'BASIC' | 'CONVERSATIONAL' | 'PROFESSIONAL' | 'NATIVE';
  }>;
  created_at: string;
  updated_at: string;
}
```

### 2.2 CV Document Model (`CVDocument`)
```typescript
interface CVDocument {
  id: string; // UUID v4
  user_id: string;
  version_name: string; // e.g., "Software Engineer - Canadian Format v2"
  original_filename: string;
  file_format: 'PDF' | 'DOCX';
  r2_storage_key: string; // Path in Cloudflare R2: documents/cv/{user_id}/{cv_id}.pdf
  sha256_checksum: string;
  extracted_raw_text?: string;
  target_country: 'CA' | 'IT' | 'ALL';
  language: 'en' | 'fr' | 'it';
  is_base_profile: boolean;
  created_at: string;
  updated_at: string;
}
```

### 2.3 Job Opportunity (`JobListing`)
```typescript
interface JobListing {
  id: string; // UUID v4
  source_id: string; // ID assigned by external provider
  source_provider: 'JOB_BANK_CA' | 'ADZUNA_CA' | 'ADZUNA_IT' | 'JOOBLE_CA' | 'JOOBLE_IT' | 'MANUAL';
  title: string;
  company_name: string;
  country: 'CA' | 'IT';
  city: string;
  province_or_region: string;
  is_remote: boolean;
  contract_type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP';
  salary_min?: number;
  salary_max?: number;
  currency: 'CAD' | 'EUR';
  description_raw: string;
  required_languages: string[];
  required_skills: string[];
  source_url: string;
  application_url?: string;
  is_verified_active: boolean;
  published_at: string;
  retrieved_at: string;
}
```

### 2.4 Matching & Eligibility Assessment (`MatchAssessment`)
```typescript
interface MatchAssessment {
  id: string;
  user_id: string;
  job_id: string;
  overall_score: number; // 0 to 100
  skills_score: number;  // 0 to 100
  experience_score: number; // 0 to 100
  language_score: number; // 0 to 100
  authorization_compatibility: 'COMPATIBLE' | 'SPONSORSHIP_REQUIRED' | 'INELIGIBLE' | 'UNCERTAIN';
  matched_skills: string[];
  missing_skills: string[];
  language_gaps: string[];
  eligibility_notes: string;
  risk_factors: string[];
  recommended_actions: string[];
  assessment_model: string; // e.g., "anthropic/claude-3.5-sonnet"
  created_at: string;
}
```

### 2.5 Application Record & Lifecycle State Machine (`ApplicationRecord`)
```typescript
type ApplicationState = 
  | 'DISCOVERED'          // Job identified, not yet analyzed
  | 'ANALYZED'            // Match and eligibility computed
  | 'READY_FOR_REVIEW'    // Tailored CV/cover letter generated, awaiting user review
  | 'APPROVED'            // User inspected and approved application packet
  | 'SUBMISSION_PENDING'  // Queued for authorized transmission
  | 'SUBMITTED'           // Successfully transmitted or manually completed by user
  | 'FAILED'              // Submission attempted but failed (API error or invalid link)
  | 'WITHDRAWN'           // User cancelled application
  | 'CLOSED';             // Application cycle terminated (rejection, offer, or expired)

interface ApplicationRecord {
  id: string;
  user_id: string;
  job_id: string;
  current_state: ApplicationState;
  tailored_cv_id?: string;
  cover_letter_text?: string;
  cover_letter_r2_key?: string;
  submission_method: 'MANUAL_ASSISTED' | 'OFFICIAL_API';
  idempotency_key: string; // Hash of user_id + job_id + submission_epoch
  submitted_at?: string;
  last_activity_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
```

### 2.6 Email Communication Log (`EmailCommunication`)
```typescript
interface EmailCommunication {
  id: string;
  application_id?: string; // Optional association with an existing application
  gmail_message_id: string;
  gmail_thread_id: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  snippet: string;
  classification: 'CONFIRMATION' | 'INTERVIEW_INVITATION' | 'INFO_REQUEST' | 'REJECTION' | 'OFFER' | 'GENERAL';
  confidence_score: number; // 0.0 to 1.0
  action_required: boolean;
  suggested_action?: string;
  received_at: string;
  created_at: string;
}
```

---

## 3. Database Schema (Cloudflare D1 SQLite)

```sql
-- Migration: 0001_initial_schema.sql

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
```

---

## 4. API Endpoints Specification (`/api/v1`)

### 4.1 Response & Error Envelope
All endpoints return a standardized JSON envelope:

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "correlation_id": "req-984f8812-3490-411a"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Cannot submit application without prior user approval.",
    "details": {
      "current_state": "READY_FOR_REVIEW",
      "required_state": "APPROVED"
    }
  },
  "correlation_id": "req-984f8812-3490-411a"
}
```

### 4.2 Endpoint Inventory

| Method | Path | Description | Auth Required | Idempotency Key Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health & readiness indicators | No | No |
| `GET` | `/api/v1/profile` | Retrieve structured user profile | Bearer JWT | No |
| `PUT` | `/api/v1/profile` | Update user profile fields | Bearer JWT | No |
| `POST` | `/api/v1/documents/cv/upload` | Upload & extract raw CV (Multipart PDF) | Bearer JWT | Yes (`X-Idempotency-Key`) |
| `GET` | `/api/v1/jobs/search` | Search jobs (query params: `country`, `keywords`, `city`, `remote`) | Bearer JWT | No |
| `GET` | `/api/v1/jobs/:id` | Get job details | Bearer JWT | No |
| `POST` | `/api/v1/jobs/:id/match` | Compute AI match assessment | Bearer JWT | No |
| `POST` | `/api/v1/applications/prepare` | Generate tailored CV & cover letter draft | Bearer JWT | Yes (`X-Idempotency-Key`) |
| `POST` | `/api/v1/applications/:id/approve` | User approves application packet | Bearer JWT | Yes (`X-Idempotency-Key`) |
| `POST` | `/api/v1/applications/:id/submit` | Execute authorized submission or mark assisted | Bearer JWT | Yes (`X-Idempotency-Key`) |
| `GET` | `/api/v1/applications` | List applications by status | Bearer JWT | No |
| `POST` | `/api/v1/gmail/sync` | Trigger incremental sync of recruiter messages | Bearer JWT | No |
| `GET` | `/api/v1/communications` | List classified email communications | Bearer JWT | No |

---

*Module Contracts established and frozen for review.*
