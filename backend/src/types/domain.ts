export type CountryCode = 'CA' | 'IT';
export type LocaleCode = 'en' | 'fr' | 'it';

export type ApplicationState = 
  | 'DISCOVERED'
  | 'ANALYZED'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'SUBMISSION_PENDING'
  | 'SUBMITTED'
  | 'FAILED'
  | 'WITHDRAWN'
  | 'CLOSED';

export type FeatureReadiness = 
  | 'NOT_CONFIGURED'
  | 'BLOCKED'
  | 'READY'
  | 'RUNNING'
  | 'FAILED'
  | 'DISABLED';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  target_countries: CountryCode[];
  primary_language: LocaleCode;
  created_at: string;
  updated_at: string;
}

export interface CVDocument {
  id: string;
  user_id: string;
  version_name: string;
  original_filename: string;
  file_format: 'PDF' | 'DOCX';
  r2_storage_key: string;
  sha256_checksum: string;
  target_country: CountryCode | 'ALL';
  language: LocaleCode;
  is_base_profile: boolean;
  created_at: string;
  updated_at: string;
}

export type JobListingStatus = 'ACTIVE' | 'EXPIRED' | 'UNKNOWN';

export interface JobListing {
  id: string;
  source_id: string;
  source_provider: string;
  source_attribution: string;
  title: string;
  company_name: string;
  country: CountryCode;
  city: string;
  province_or_region: string;
  is_remote: boolean;
  contract_type: string;
  salary_min?: number;
  salary_max?: number;
  currency: 'CAD' | 'EUR';
  description_raw: string;
  description_summary?: string;
  required_languages: string[];
  required_skills: string[];
  source_url: string;
  application_url?: string;
  content_hash: string;
  status: JobListingStatus;
  published_at?: string;
  retrieved_at: string;
}

export interface JobProviderStatus {
  name: string;
  coverage: string;
  status: 'ACTIVE' | 'BLOCKED' | 'NOT_CONFIGURED' | 'FAILED';
  reason?: string;
  last_sync_at?: string;
}

export interface JobSearchQuery {
  country?: CountryCode | 'ALL';
  query?: string;
  location?: string;
  isRemote?: boolean;
  page?: number;
  limit?: number;
}

export interface JobSearchResponse {
  items: JobListing[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
  source_providers: JobProviderStatus[];
}

export interface MatchAssessment {
  id: string;
  user_id: string;
  job_id: string;
  overall_score: number;
  skills_score: number;
  experience_score: number;
  language_score: number;
  authorization_compatibility: string;
  matched_skills: string[];
  missing_skills: string[];
  risk_factors: string[];
  recommended_actions: string[];
  assessment_model: string;
  created_at: string;
}

export interface ApplicationRecord {
  id: string;
  user_id: string;
  job_id: string;
  current_state: ApplicationState;
  tailored_cv_id?: string;
  cover_letter_text?: string;
  submission_method: 'MANUAL_ASSISTED' | 'OFFICIAL_API';
  idempotency_key: string;
  submitted_at?: string;
  last_activity_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
