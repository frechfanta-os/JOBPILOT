import test from 'node:test';
import assert from 'node:assert';
import worker from '../src/index.js';
import { Env } from '../src/types/env.js';
import { signJwt } from '../src/utils/jwt.js';

const TEST_SECRET = 'jobpilot-dev-jwt-hmac-sha256-secret-not-for-production';

class MockD1JobsDatabase {
  public jobs = new Map<string, any>();

  prepare(query: string) {
    const db = this;
    return {
      bind(...args: any[]) {
        return {
          async run() {
            if (query.includes('INSERT INTO job_listings')) {
              const [
                id, source_id, source_provider, source_attribution, title, company_name,
                country, city, province_or_region, is_remote, contract_type,
                salary_min, salary_max, currency, description_raw, description_summary,
                required_languages, required_skills, source_url, application_url,
                content_hash, status, published_at, retrieved_at
              ] = args;
              db.jobs.set(id, {
                id, source_id, source_provider, source_attribution, title, company_name,
                country, city, province_or_region, is_remote, contract_type,
                salary_min, salary_max, currency, description_raw, description_summary,
                required_languages, required_skills, source_url, application_url,
                content_hash, status, published_at, retrieved_at
              });
            }
            return { success: true };
          },
          async first<T = any>(): Promise<T | null> {
            if (query.includes('SELECT * FROM job_listings WHERE id = ?')) {
              const [id] = args;
              return (db.jobs.get(id) as T) || null;
            }
            if (query.includes('SELECT COUNT(*) as total FROM job_listings')) {
              return { total: db.jobs.size } as T;
            }
            return null;
          },
          async all<T = any>(): Promise<{ results: T[] }> {
            if (query.includes('SELECT * FROM job_listings')) {
              return { results: Array.from(db.jobs.values()) as T[] };
            }
            return { results: [] };
          },
        };
      },
    };
  }
}

const mockDb = new MockD1JobsDatabase();

// Seed mockDb with one sample job
mockDb.jobs.set('job_seed_test_1', {
  id: 'job_seed_test_1',
  source_id: 'seed_1',
  source_provider: 'REMOTIVE',
  source_attribution: 'Remotive (Official Remote Jobs API)',
  title: 'Senior Mobile Engineer',
  company_name: 'TestTech Labs',
  country: 'CA',
  city: 'Montreal',
  province_or_region: 'Quebec',
  is_remote: 1,
  contract_type: 'FULL_TIME',
  salary_min: 110000,
  salary_max: 140000,
  currency: 'CAD',
  description_raw: 'Building mission-critical Flutter systems.',
  description_summary: 'Building mission-critical Flutter systems.',
  required_languages: '["en","fr"]',
  required_skills: '["Flutter","Dart"]',
  source_url: 'https://testtech.com/jobs/1',
  application_url: 'https://testtech.com/jobs/1/apply',
  content_hash: 'hash_test_123456789',
  status: 'ACTIVE',
  published_at: new Date().toISOString(),
  retrieved_at: new Date().toISOString(),
});

const mockEnv: Env = {
  DB: mockDb as any,
  DOCUMENTS_BUCKET: {} as any,
  CONFIG_KV: {} as any,
  ENVIRONMENT: 'test',
  API_VERSION: 'v1',
  EMERGENCY_STOP_DEFAULT: 'false',
  JWT_SIGNING_SECRET: TEST_SECRET,
};

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

async function getValidToken() {
  return signJwt({
    sub: 'usr_job_seeker_1',
    email: 'seeker@jobpilot.app',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, TEST_SECRET);
}

test('GET /api/v1/jobs without auth returns 401 UNAUTHORIZED', async () => {
  const req = new Request('https://api.jobpilot.app/api/v1/jobs');
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 401);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'UNAUTHORIZED');
});

test('GET /api/v1/jobs with invalid country parameter returns 400 INVALID_PARAMETER', async () => {
  const token = await getValidToken();
  const req = new Request('https://api.jobpilot.app/api/v1/jobs?country=FR', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 400);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'INVALID_PARAMETER');
});

test('GET /api/v1/jobs returns paginated job listings with honest provider status', async () => {
  const token = await getValidToken();
  const req = new Request('https://api.jobpilot.app/api/v1/jobs?country=CA&limit=10', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data.items));
  assert.ok(json.data.source_providers.length >= 2);

  // Verify honest provider disclosure
  const remotiveStatus = json.data.source_providers.find((p: any) => p.name === 'Remotive');
  assert.ok(remotiveStatus);
  assert.strictEqual(remotiveStatus.status, 'ACTIVE');

  const adzunaStatus = json.data.source_providers.find((p: any) => p.name === 'Adzuna');
  assert.ok(adzunaStatus);
  assert.strictEqual(adzunaStatus.status, 'BLOCKED'); // Unconfigured credentials marked honestly
});

test('GET /api/v1/jobs caps page limit at 50 to prevent unbounded queries', async () => {
  const token = await getValidToken();
  const req = new Request('https://api.jobpilot.app/api/v1/jobs?limit=500', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.data.limit, 50); // Capped at 50
});

test('GET /api/v1/jobs/:id returns 200 with full details when job exists', async () => {
  const token = await getValidToken();
  const req = new Request('https://api.jobpilot.app/api/v1/jobs/job_seed_test_1', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.id, 'job_seed_test_1');
  assert.strictEqual(json.data.title, 'Senior Mobile Engineer');
  assert.strictEqual(json.data.company_name, 'TestTech Labs');
  assert.strictEqual(json.data.country, 'CA');
  assert.strictEqual(json.data.currency, 'CAD');
});

test('GET /api/v1/jobs/:id returns 404 when job does not exist', async () => {
  const token = await getValidToken();
  const req = new Request('https://api.jobpilot.app/api/v1/jobs/job_does_not_exist', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 404);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'NOT_FOUND');
});
