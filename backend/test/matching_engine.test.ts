import test from 'node:test';
import assert from 'node:assert';
import { MatchingEngine } from '../src/services/matching/matching_engine.js';
import { JobListing, UserProfile } from '../src/types/domain.js';
import { Env } from '../src/types/env.js';

const mockEnv: Env = {
  ENVIRONMENT: 'test',
  API_VERSION: 'v1',
  EMERGENCY_STOP_DEFAULT: 'false',
  DB: {} as any,
  DOCUMENTS_BUCKET: {} as any,
  CONFIG_KV: {} as any,
  JWT_SIGNING_SECRET: 'test-secret',
};

const sampleJob: JobListing = {
  id: 'job-toronto-flutter',
  source_id: 'src-123',
  source_provider: 'test-feed',
  source_attribution: 'Test Attribution',
  title: 'Senior Mobile Engineer (Flutter & TypeScript)',
  company_name: 'MapleTech Solutions',
  country: 'CA',
  city: 'Toronto',
  province_or_region: 'ON',
  is_remote: true,
  contract_type: 'FULL_TIME',
  currency: 'CAD',
  description_raw: 'We are seeking a Senior Mobile Engineer with strong experience in Flutter, Dart, TypeScript, and Cloud APIs.',
  required_languages: ['en'],
  required_skills: ['Flutter', 'TypeScript', 'Node.js', 'Docker'],
  source_url: 'https://example.com/job/1',
  content_hash: 'hash123',
  status: 'ACTIVE',
  retrieved_at: new Date().toISOString(),
};

const sampleProfile: UserProfile = {
  id: 'user-cand-1',
  email: 'alex@example.com',
  first_name: 'Alex',
  last_name: 'Mercer',
  target_countries: ['CA'],
  primary_language: 'en',
  work_authorization: {
    canada_status: 'PERMANENT_RESIDENT',
    italy_status: 'UNKNOWN',
    verified_by_user: true,
  },
  skills: [
    { name: 'Flutter', level: 'ADVANCED', years_of_experience: 4, is_confirmed: true },
    { name: 'TypeScript', level: 'ADVANCED', years_of_experience: 5, is_confirmed: true },
    { name: 'Node.js', level: 'INTERMEDIATE', years_of_experience: 3, is_confirmed: true },
    { name: 'PostgreSQL', level: 'INTERMEDIATE', years_of_experience: 3, is_confirmed: true },
  ],
  experiences: [
    {
      company_name: 'NorthTech Labs',
      job_title: 'Senior Mobile Developer',
      start_date: '2021-01',
      is_current: true,
      description: 'Built cross-platform Flutter mobile applications and backend TypeScript services.',
      technologies: ['Flutter', 'TypeScript', 'Node.js'],
      is_confirmed: true,
    },
    {
      company_name: 'Alpha Systems',
      job_title: 'Software Developer',
      start_date: '2018-05',
      end_date: '2020-12',
      is_current: false,
      description: 'Developed mobile UI and REST APIs.',
      technologies: ['Dart', 'JavaScript'],
      is_confirmed: true,
    },
  ],
  education: [
    {
      institution: 'University of Toronto',
      degree_name: 'Bachelor of Science in Computer Science',
      field_of_study: 'Software Engineering',
      graduation_year: 2018,
      is_confirmed: true,
    },
  ],
  languages: [
    { code: 'en', name: 'English', proficiency: 'NATIVE', is_confirmed: true },
    { code: 'fr', name: 'French', proficiency: 'CONVERSATIONAL', is_confirmed: true },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

test('MatchingEngine: calculates reproducible score with exact default weights', async () => {
  const engine = new MatchingEngine();
  const assessment = await engine.assessMatch(sampleJob, sampleProfile, mockEnv, { skipAiEnrichment: true });

  assert.strictEqual(assessment.user_id, sampleProfile.id);
  assert.strictEqual(assessment.job_id, sampleJob.id);
  assert.strictEqual(assessment.scoring_version, MatchingEngine.SCORING_VERSION);

  // Default weights check
  assert.strictEqual(assessment.criteria_weights.skills, 0.40);
  assert.strictEqual(assessment.criteria_weights.experience, 0.25);
  assert.strictEqual(assessment.criteria_weights.education, 0.15);
  assert.strictEqual(assessment.criteria_weights.language, 0.10);
  assert.strictEqual(assessment.criteria_weights.location, 0.10);

  // Overall score must be weighted sum
  const expectedWeighted = Math.round(
    assessment.skills_score * 0.40 +
    assessment.experience_score * 0.25 +
    assessment.education_score * 0.15 +
    assessment.language_score * 0.10 +
    assessment.location_score * 0.10
  );
  assert.strictEqual(assessment.overall_score, expectedWeighted);

  // Candidate has 3 out of 4 skills (Flutter, TypeScript, Node.js; missing Docker)
  assert.strictEqual(assessment.skills_score, 75);
  assert.deepStrictEqual(assessment.matched_skills.sort(), ['Flutter', 'Node.js', 'TypeScript'].sort());
  assert.deepStrictEqual(assessment.missing_skills, ['Docker']);

  // Remote job gives 100% location score
  assert.strictEqual(assessment.location_score, 100);

  // Education score (Bachelor) is 90
  assert.strictEqual(assessment.education_score, 90);

  // Language score (English matched) is 100
  assert.strictEqual(assessment.language_score, 100);
});

test('MatchingEngine: recognizes skill synonyms (e.g. ts -> typescript, node -> node.js)', async () => {
  const engine = new MatchingEngine();
  const profileWithAliases: UserProfile = {
    ...sampleProfile,
    skills: [
      { name: 'ts', is_confirmed: true },
      { name: 'react', is_confirmed: true },
    ],
  };

  const jobWithSynonyms: JobListing = {
    ...sampleJob,
    required_skills: ['TypeScript', 'React.js'],
  };

  const assessment = await engine.assessMatch(jobWithSynonyms, profileWithAliases, mockEnv, { skipAiEnrichment: true });
  assert.strictEqual(assessment.skills_score, 100);
  assert.strictEqual(assessment.missing_skills.length, 0);
});

test('MatchingEngine: accurately identifies Canada and Italy work authorization status', async () => {
  const engine = new MatchingEngine();

  // 1. Permanent Resident in Canada -> ELIGIBLE
  const assessCaEligible = await engine.assessMatch(sampleJob, sampleProfile, mockEnv, { skipAiEnrichment: true });
  assert.strictEqual(assessCaEligible.authorization_compatibility, 'ELIGIBLE');

  // 2. Needs Sponsorship
  const profileNeedsSponsorship: UserProfile = {
    ...sampleProfile,
    work_authorization: {
      canada_status: 'NEED_SPONSORSHIP',
      italy_status: 'UNKNOWN',
      verified_by_user: true,
    },
  };
  const assessCaSponsor = await engine.assessMatch(sampleJob, profileNeedsSponsorship, mockEnv, { skipAiEnrichment: true });
  assert.strictEqual(assessCaSponsor.authorization_compatibility, 'NEEDS_SPONSORSHIP');
  assert.ok(assessCaSponsor.risk_factors.some((r) => r.includes('sponsorship')));

  // 3. Italy EU Citizen -> ELIGIBLE
  const italianJob: JobListing = {
    ...sampleJob,
    id: 'job-milan-it',
    country: 'IT',
    city: 'Milan',
    required_languages: ['it'],
  };
  const profileItalianEligible: UserProfile = {
    ...sampleProfile,
    target_countries: ['IT'],
    work_authorization: {
      canada_status: 'UNKNOWN',
      italy_status: 'EU_CITIZEN',
      verified_by_user: true,
    },
  };
  const assessItEligible = await engine.assessMatch(italianJob, profileItalianEligible, mockEnv, { skipAiEnrichment: true });
  assert.strictEqual(assessItEligible.authorization_compatibility, 'ELIGIBLE');

  // 4. Unknown work authorization is NOT penalized as disqualified, but recorded in unverified_requirements
  const profileUnknownAuth: UserProfile = {
    ...sampleProfile,
    work_authorization: undefined,
  };
  const assessUnknown = await engine.assessMatch(sampleJob, profileUnknownAuth, mockEnv, { skipAiEnrichment: true });
  assert.strictEqual(assessUnknown.authorization_compatibility, 'UNVERIFIED_OR_UNKNOWN');
  assert.ok(assessUnknown.unverified_requirements.some((u) => u.toLowerCase().includes('work authorization')));
});

test('MatchingEngine: provides actionable recommendations and grounded evidence', async () => {
  const engine = new MatchingEngine();
  const assessment = await engine.assessMatch(sampleJob, sampleProfile, mockEnv, { skipAiEnrichment: true });

  assert.ok(assessment.matching_evidence.length > 0);
  assert.ok(assessment.recommended_actions.length > 0);
  // Verifies that missing Docker skill triggered an action to emphasize transferable skills
  assert.ok(assessment.recommended_actions.some((a) => a.includes('Docker')));
});
