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

export interface WorkAuthorizationStatus {
  canada_status: 'CITIZEN' | 'PERMANENT_RESIDENT' | 'WORK_PERMIT' | 'NEED_SPONSORSHIP' | 'UNKNOWN';
  italy_status: 'CITIZEN' | 'EU_CITIZEN' | 'PERMESSO_DI_SOGGIORNO' | 'NEED_SPONSORSHIP' | 'UNKNOWN';
  verified_by_user: boolean;
}

export interface SkillDetail {
  id?: string;
  name: string;
  level?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  years_of_experience?: number;
  is_confirmed?: boolean;
}

export interface ExperienceDetail {
  id?: string;
  company_name: string;
  job_title: string;
  location?: string;
  start_date: string; // YYYY-MM
  end_date?: string | null;
  is_current: boolean;
  description: string;
  technologies?: string[];
  is_confirmed?: boolean;
}

export interface EducationDetail {
  id?: string;
  institution: string;
  degree_name: string;
  field_of_study?: string;
  graduation_year?: number;
  is_confirmed?: boolean;
}

export interface LanguageDetail {
  code: string;
  name?: string;
  proficiency?: 'BASIC' | 'CONVERSATIONAL' | 'PROFESSIONAL' | 'NATIVE';
  is_confirmed?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  location?: string;
  headline?: string;
  summary?: string;
  target_countries: CountryCode[];
  primary_language: LocaleCode;
  work_authorization?: WorkAuthorizationStatus;
  skills?: SkillDetail[];
  experiences?: ExperienceDetail[];
  education?: EducationDetail[];
  languages?: LanguageDetail[];
  is_confirmed_by_user?: boolean;
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

export interface CriteriaWeights {
  skills: number;       // default 0.40
  experience: number;   // default 0.25
  education: number;    // default 0.15
  language: number;     // default 0.10
  location: number;     // default 0.10
}

export interface MatchingEvidence {
  qualification: string;
  evidence: string;
  confidence: number;
}

export type AuthorizationCompatibility = 
  | 'ELIGIBLE'
  | 'NEEDS_SPONSORSHIP'
  | 'UNVERIFIED_OR_UNKNOWN'
  | 'INELIGIBLE';

export interface MatchAssessment {
  id: string;
  user_id: string;
  job_id: string;
  overall_score: number; // 0 - 100
  skills_score: number;
  experience_score: number;
  education_score: number;
  language_score: number;
  location_score: number;
  criteria_weights: CriteriaWeights;
  authorization_compatibility: AuthorizationCompatibility;
  matched_skills: string[];
  missing_skills: string[];
  matching_evidence: MatchingEvidence[];
  risk_factors: string[];
  unverified_requirements: string[];
  recommended_actions: string[];
  assessment_model: string;
  scoring_version: string;
  profile_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export type DocumentType = 'CV' | 'COVER_LETTER';
export type DocumentStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED';

export interface TailoredDocument {
  id: string;
  user_id: string;
  job_id: string;
  document_type: DocumentType;
  language: LocaleCode;
  version_number: number;
  title: string;
  content_markdown: string;
  status: DocumentStatus;
  generation_model: string;
  generation_notes?: string;
  created_at: string;
  updated_at: string;
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
