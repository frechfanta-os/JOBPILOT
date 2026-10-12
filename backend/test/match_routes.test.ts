import test from 'node:test';
import assert from 'node:assert';
import worker from '../src/index.js';
import { Env } from '../src/types/env.js';
import { signJwt } from '../src/utils/jwt.js';

const TEST_SECRET = 'jobpilot-dev-jwt-hmac-sha256-secret-not-for-production';

class MockD1Database {
  public jobs = new Map<string, any>();
  public users = new Map<string, any>();
  public matches = new Map<string, any>();

  prepare(query: string) {
    const db = this;
    return {
      bind(...args: any[]) {
        return {
          async run() {
            if (query.includes('INSERT INTO match_assessments')) {
              const [
                id, user_id, job_id, overall_score, skills_score, experience_score,
                education_score, language_score, location_score, criteria_weights,
                authorization_compatibility, matched_skills, missing_skills,
                matching_evidence, risk_factors, unverified_requirements,
                recommended_actions, assessment_model, scoring_version,
                profile_updated_at, created_at, updated_at
              ] = args;

              // Check conflict on user_id, job_id
              const existingKey = Array.from(db.matches.keys()).find(k => {
                const m = db.matches.get(k);
                return m.user_id === user_id && m.job_id === job_id;
              });

              const key = existingKey || id;
              db.matches.set(key, {
                id: key,
                user_id,
                job_id,
                overall_score,
                skills_score,
                experience_score,
                education_score,
                language_score,
                location_score,
                criteria_weights,
                authorization_compatibility,
                matched_skills,
                missing_skills,
                matching_evidence,
                risk_factors,
                unverified_requirements,
                recommended_actions,
                assessment_model,
                scoring_version,
                profile_updated_at,
                created_at,
                updated_at,
              });
              return { success: true };
            }
            return { success: true };
          },
          async first<T = any>(): Promise<T | null> {
            if (query.includes('SELECT * FROM job_listings WHERE id = ?')) {
              const [jobId] = args;
              return (db.jobs.get(jobId) as T) || null;
            }
            if (query.includes('SELECT * FROM users WHERE id = ?')) {
              const [userId] = args;
              return (db.users.get(userId) as T) || null;
            }
            if (query.includes('SELECT * FROM match_assessments WHERE id = ?')) {
              const [matchId] = args;
              return (db.matches.get(matchId) as T) || null;
            }
            if (query.includes('SELECT * FROM match_assessments WHERE user_id = ? AND job_id = ?')) {
              const [userId, jobId] = args;
              for (const m of db.matches.values()) {
                if (m.user_id === userId && m.job_id === jobId) return m as T;
              }
              return null;
            }
            return null;
          },
          async all<T = any>(): Promise<{ results: T[] }> {
            if (query.includes('FROM match_assessments WHERE user_id = ?')) {
              const [userId] = args;
              const results: any[] = [];
              for (const m of db.matches.values()) {
                if (m.user_id === userId) results.push(m);
              }
              return { results: results as T[] };
            }
            return { results: [] };
          },
        };
      },
    };
  }
}

function createTestEnv(mockDb: MockD1Database): Env {
  return {
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
    EMERGENCY_STOP_DEFAULT: 'false',
    DB: mockDb as any,
    DOCUMENTS_BUCKET: {} as any,
    CONFIG_KV: {} as any,
    JWT_SIGNING_SECRET: TEST_SECRET,
  };
}

async function getValidToken(userId: string, email: string = `${userId}@test.com`) {
  return signJwt({
    sub: userId,
    email,
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'user',
  }, TEST_SECRET);
}

test('POST /api/v1/matches/assess: generates explainable match assessment and persists in D1', async () => {
  const db = new MockD1Database();
  const env = createTestEnv(db);

  // Seed job
  db.jobs.set('job-ca-1', {
    id: 'job-ca-1',
    source_id: 's1',
    source_provider: 'test',
    title: 'Senior Flutter Developer',
    company_name: 'Shopify Partner',
    country: 'CA',
    city: 'Ottawa',
    province_or_region: 'ON',
    is_remote: 1,
    contract_type: 'FULL_TIME',
    currency: 'CAD',
    description_raw: 'Experienced Flutter developer with Dart and REST API skills.',
    required_languages: JSON.stringify(['en']),
    required_skills: JSON.stringify(['Flutter', 'Dart', 'GraphQL']),
    source_url: 'https://example.com/job/ca-1',
    content_hash: 'h1',
    status: 'ACTIVE',
    retrieved_at: new Date().toISOString(),
  });

  // Seed user with confirmed profile
  const userProfile = {
    id: 'user-cand-10',
    email: 'dev@test.com',
    first_name: 'Sarah',
    last_name: 'Connor',
    target_countries: ['CA'],
    primary_language: 'en',
    work_authorization: {
      canada_status: 'CITIZEN',
      italy_status: 'UNKNOWN',
      verified_by_user: true,
    },
    skills: [
      { name: 'Flutter', level: 'EXPERT', years_of_experience: 5, is_confirmed: true },
      { name: 'Dart', level: 'ADVANCED', years_of_experience: 5, is_confirmed: true },
    ],
    experiences: [
      {
        company_name: 'SkyNet Tech',
        job_title: 'Senior Mobile Engineer',
        start_date: '2019-01',
        is_current: true,
        description: 'Led mobile application architecture in Flutter.',
        technologies: ['Flutter', 'Dart'],
        is_confirmed: true,
      },
    ],
    languages: [{ code: 'en', proficiency: 'NATIVE', is_confirmed: true }],
  };

  db.users.set('user-cand-10', {
    id: 'user-cand-10',
    email: 'dev@test.com',
    first_name: 'Sarah',
    last_name: 'Connor',
    profile_data: JSON.stringify(userProfile),
  });

  const token = await getValidToken('user-cand-10', 'dev@test.com');

  const req = new Request('https://api.jobpilot.internal/api/v1/matches/assess', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      job_id: 'job-ca-1',
      options: { skipAiEnrichment: true },
    }),
  });

  const res = await worker.fetch(req, env, {} as any);
  assert.strictEqual(res.status, 200);

  const body = (await res.json()) as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.user_id, 'user-cand-10');
  assert.strictEqual(body.data.job_id, 'job-ca-1');
  assert.strictEqual(body.data.authorization_compatibility, 'ELIGIBLE');
  assert.deepStrictEqual(body.data.matched_skills.sort(), ['Dart', 'Flutter'].sort());
  assert.deepStrictEqual(body.data.missing_skills, ['GraphQL']);
  assert.ok(body.data.overall_score > 0);

  // Verifies stored in mock DB
  assert.strictEqual(db.matches.size, 1);
});

test('GET /api/v1/matches/:id enforces cross-tenant multi-tenant isolation', async () => {
  const db = new MockD1Database();
  const env = createTestEnv(db);

  // Assessment owned by User A
  db.matches.set('match-999', {
    id: 'match-999',
    user_id: 'user-cand-10',
    job_id: 'job-ca-1',
    overall_score: 85,
    skills_score: 90,
    experience_score: 80,
    education_score: 80,
    language_score: 100,
    location_score: 100,
    criteria_weights: JSON.stringify({ skills: 0.4, experience: 0.25, education: 0.15, language: 0.1, location: 0.1 }),
    authorization_compatibility: 'ELIGIBLE',
    matched_skills: JSON.stringify(['Flutter']),
    missing_skills: JSON.stringify([]),
    matching_evidence: JSON.stringify([]),
    risk_factors: JSON.stringify([]),
    unverified_requirements: JSON.stringify([]),
    recommended_actions: JSON.stringify([]),
    assessment_model: 'deterministic-rules-v1',
    scoring_version: 'v1.0-deterministic',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // User B tries to view User A's assessment
  const userBToken = await getValidToken('user-cand-attacker', 'attacker@test.com');

  const req = new Request('https://api.jobpilot.internal/api/v1/matches/match-999', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userBToken}`,
    },
  });

  const res = await worker.fetch(req, env, {} as any);
  assert.strictEqual(res.status, 403);
  const body = (await res.json()) as any;
  assert.strictEqual(body.error.code, 'FORBIDDEN');
});

test('GET /api/v1/matches/by-job/:jobId retrieves existing match assessment', async () => {
  const db = new MockD1Database();
  const env = createTestEnv(db);

  db.matches.set('match-user10-jobca1', {
    id: 'match-user10-jobca1',
    user_id: 'user-cand-10',
    job_id: 'job-ca-1',
    overall_score: 88,
    skills_score: 90,
    experience_score: 85,
    education_score: 80,
    language_score: 100,
    location_score: 100,
    criteria_weights: JSON.stringify({ skills: 0.4, experience: 0.25, education: 0.15, language: 0.1, location: 0.1 }),
    authorization_compatibility: 'ELIGIBLE',
    matched_skills: JSON.stringify(['Flutter', 'Dart']),
    missing_skills: JSON.stringify([]),
    matching_evidence: JSON.stringify([]),
    risk_factors: JSON.stringify([]),
    unverified_requirements: JSON.stringify([]),
    recommended_actions: JSON.stringify([]),
    assessment_model: 'deterministic-rules-v1',
    scoring_version: 'v1.0-deterministic',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const token = await getValidToken('user-cand-10', 'dev@test.com');

  const req = new Request('https://api.jobpilot.internal/api/v1/matches/by-job/job-ca-1', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const res = await worker.fetch(req, env, {} as any);
  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as any;
  assert.strictEqual(body.data.id, 'match-user10-jobca1');
  assert.strictEqual(body.data.overall_score, 88);
});
