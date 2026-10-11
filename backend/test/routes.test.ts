import test from 'node:test';
import assert from 'node:assert';
import worker from '../src/index.js';
import { Env } from '../src/types/env.js';
import { signJwt } from '../src/utils/jwt.js';

const TEST_SECRET = 'jobpilot-dev-jwt-hmac-sha256-secret-not-for-production';

const mockEnv: Env = {
  DB: {} as any,
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

async function getValidToken(userId = 'usr_test_candidate_123') {
  return signJwt({
    sub: userId,
    email: `${userId}@jobpilot.app`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, TEST_SECRET);
}

test('GET /api/v1/health returns 200 with standard envelope', async () => {
  const req = new Request('https://api.jobpilot.app/api/v1/health');
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.status, 'healthy');
  assert.strictEqual(json.data.version, 'v1');
  assert.ok(json.correlation_id);
});

test('GET /api/v1/profile without auth returns 401 UNAUTHORIZED', async () => {
  const req = new Request('https://api.jobpilot.app/api/v1/profile');
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 401);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'UNAUTHORIZED');
  assert.ok(json.correlation_id);
});

test('GET /api/v1/profile with tampered JWT returns 401 UNAUTHORIZED', async () => {
  const token = await getValidToken();
  const tampered = token.substring(0, token.length - 5) + 'xxxxx';
  const req = new Request('https://api.jobpilot.app/api/v1/profile', {
    headers: {
      Authorization: `Bearer ${tampered}`,
    },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 401);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'UNAUTHORIZED');
});

test('GET /api/v1/profile with expired JWT returns 401 UNAUTHORIZED', async () => {
  const expiredToken = await signJwt({
    sub: 'usr_expired',
    exp: Math.floor(Date.now() / 1000) - 60, // expired 60 seconds ago
  }, TEST_SECRET);

  const req = new Request('https://api.jobpilot.app/api/v1/profile', {
    headers: {
      Authorization: `Bearer ${expiredToken}`,
    },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 401);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'UNAUTHORIZED');
});

test('GET /api/v1/profile with valid signed JWT returns 200', async () => {
  const token = await getValidToken('usr_test_candidate_123');
  const req = new Request('https://api.jobpilot.app/api/v1/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.id, 'usr_test_candidate_123');
});

test('POST /api/v1/applications without X-Idempotency-Key returns 400', async () => {
  const token = await getValidToken();
  const req = new Request('https://api.jobpilot.app/api/v1/applications', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ job_id: 'job_456' }),
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 400);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'MISSING_IDEMPOTENCY_KEY');
});

test('POST /api/v1/applications with X-Idempotency-Key succeeds', async () => {
  const token = await getValidToken();
  const req = new Request('https://api.jobpilot.app/api/v1/applications', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'idemp_unique_key_001',
    },
    body: JSON.stringify({ job_id: 'job_456' }),
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 201);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.idempotency_key, 'idemp_unique_key_001');
  assert.strictEqual(json.data.current_state, 'DISCOVERED');
});
