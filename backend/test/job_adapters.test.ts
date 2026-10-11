import test from 'node:test';
import assert from 'node:assert';
import { Env } from '../src/types/env.js';
import { RemotiveJobAdapter } from '../src/services/adapters/remotive.js';
import { ArbeitnowJobAdapter } from '../src/services/adapters/arbeitnow.js';
import { AdzunaJobAdapter } from '../src/services/adapters/adzuna.js';
import { JoobleJobAdapter } from '../src/services/adapters/jooble.js';

const mockEnvUnconfigured: Env = {
  DB: {} as any,
  DOCUMENTS_BUCKET: {} as any,
  CONFIG_KV: {} as any,
  ENVIRONMENT: 'test',
  API_VERSION: 'v1',
  EMERGENCY_STOP_DEFAULT: 'false',
};

test('RemotiveJobAdapter: reports ACTIVE status without proprietary credentials', async () => {
  const adapter = new RemotiveJobAdapter();
  const status = await adapter.getStatus(mockEnvUnconfigured);

  assert.strictEqual(status.name, 'Remotive');
  assert.strictEqual(status.status, 'ACTIVE');
  assert.ok(status.coverage.includes('Canada'));
});

test('ArbeitnowJobAdapter: reports ACTIVE status without proprietary credentials', async () => {
  const adapter = new ArbeitnowJobAdapter();
  const status = await adapter.getStatus(mockEnvUnconfigured);

  assert.strictEqual(status.name, 'Arbeitnow');
  assert.strictEqual(status.status, 'ACTIVE');
  assert.ok(status.coverage.includes('Italy'));
});

test('AdzunaJobAdapter: honestly reports BLOCKED when ADZUNA_APP_ID/KEY missing', async () => {
  const adapter = new AdzunaJobAdapter();
  const status = await adapter.getStatus(mockEnvUnconfigured);

  assert.strictEqual(status.name, 'Adzuna');
  assert.strictEqual(status.status, 'BLOCKED');
  assert.ok(status.reason?.includes('credentials not configured'));

  const searchResult = await adapter.search({ country: 'CA' }, mockEnvUnconfigured);
  assert.strictEqual(searchResult.status, 'BLOCKED');
  assert.strictEqual(searchResult.items.length, 0);
  assert.ok(searchResult.errorMessage?.includes('ADZUNA_APP_ID and ADZUNA_APP_KEY'));
});

test('JoobleJobAdapter: honestly reports BLOCKED when JOOBLE_API_KEY missing', async () => {
  const adapter = new JoobleJobAdapter();
  const status = await adapter.getStatus(mockEnvUnconfigured);

  assert.strictEqual(status.name, 'Jooble');
  assert.strictEqual(status.status, 'BLOCKED');
  assert.ok(status.reason?.includes('JOOBLE_API_KEY'));

  const searchResult = await adapter.search({ country: 'IT' }, mockEnvUnconfigured);
  assert.strictEqual(searchResult.status, 'BLOCKED');
  assert.strictEqual(searchResult.items.length, 0);
  assert.ok(searchResult.errorMessage?.includes('JOOBLE_API_KEY'));
});

test('ArbeitnowJobAdapter: gracefully returns empty when querying Canada only', async () => {
  const adapter = new ArbeitnowJobAdapter();
  const searchResult = await adapter.search({ country: 'CA' }, mockEnvUnconfigured);

  assert.strictEqual(searchResult.status, 'ACTIVE');
  assert.strictEqual(searchResult.items.length, 0);
});
