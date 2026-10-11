import test from 'node:test';
import assert from 'node:assert';
import worker from '../src/index.js';
import { Env } from '../src/types/env.js';

const mockEnv: Env = {
  DB: {} as any,
  DOCUMENTS_BUCKET: {} as any,
  CONFIG_KV: {} as any,
  ENVIRONMENT: 'test',
  API_VERSION: 'v1',
  EMERGENCY_STOP_DEFAULT: 'false',
};

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

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

test('GET /api/v1/profile with Bearer token returns 200', async () => {
  const req = new Request('https://api.jobpilot.app/api/v1/profile', {
    headers: {
      Authorization: 'Bearer usr_test_candidate_123',
    },
  });
  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.id, 'usr_test_candidate_123');
});

test('POST /api/v1/applications without X-Idempotency-Key returns 400', async () => {
  const req = new Request('https://api.jobpilot.app/api/v1/applications', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer usr_test_candidate_123',
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
  const req = new Request('https://api.jobpilot.app/api/v1/applications', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer usr_test_candidate_123',
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
