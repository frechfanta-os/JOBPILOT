import test from 'node:test';
import assert from 'node:assert';
import worker from '../src/index.js';
import { Env } from '../src/types/env.js';
import { signJwt } from '../src/utils/jwt.js';

const TEST_SECRET = 'jobpilot-dev-jwt-hmac-sha256-secret-not-for-production';

// In-memory test doubles for D1 and R2
class MockR2Bucket {
  private store = new Map<string, { data: Uint8Array; options?: any }>();

  async put(key: string, value: Uint8Array, options?: any) {
    this.store.set(key, { data: value, options });
    return { key, size: value.length };
  }

  async get(key: string) {
    const item = this.store.get(key);
    if (!item) return null;
    return {
      arrayBuffer: async () => item.data.buffer,
    };
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

class MockD1Database {
  public records = new Map<string, any>();

  prepare(query: string) {
    const db = this;
    return {
      bind(...args: any[]) {
        return {
          async run() {
            if (query.includes('INSERT INTO cv_documents')) {
              const [id, user_id, version_name, original_filename, file_format, r2_storage_key, sha256_checksum, target_country, language, is_base_profile, created_at, updated_at] = args;
              db.records.set(id, {
                id,
                user_id,
                version_name,
                original_filename,
                file_format: 'PDF',
                r2_storage_key,
                sha256_checksum,
                target_country,
                language,
                is_base_profile,
                created_at,
                updated_at,
              });
              return { success: true };
            }
            if (query.includes('DELETE FROM cv_documents')) {
              const [id, user_id] = args;
              const existing = db.records.get(id);
              if (existing && existing.user_id === user_id) {
                db.records.delete(id);
              }
              return { success: true };
            }
            return { success: true };
          },
          async first<T = any>(): Promise<T | null> {
            if (query.includes('SELECT * FROM cv_documents WHERE id = ?')) {
              const [id] = args;
              return (db.records.get(id) as T) || null;
            }
            return null;
          },
          async all<T = any>(): Promise<{ results: T[] }> {
            if (query.includes('SELECT * FROM cv_documents WHERE user_id = ?')) {
              const [userId] = args;
              const matches: T[] = [];
              for (const doc of db.records.values()) {
                if (doc.user_id === userId) {
                  matches.push(doc as T);
                }
              }
              return { results: matches };
            }
            return { results: [] };
          },
        };
      },
    };
  }
}

const mockBucket = new MockR2Bucket();
const mockDb = new MockD1Database();

const mockEnv: Env = {
  DB: mockDb as any,
  DOCUMENTS_BUCKET: mockBucket as any,
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

async function getValidToken(userId: string) {
  return signJwt({
    sub: userId,
    email: `${userId}@jobpilot.app`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, TEST_SECRET);
}

// Helper to create valid base64 PDF bytes (%PDF-1.4...)
function createSamplePdfBase64(): string {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-
  const content = [0x31, 0x2E, 0x34, 0x0A]; // 1.4\n
  const body = Array.from(Buffer.from('Test CV document content with professional experience'));
  const bytes = new Uint8Array([...header, ...content, ...body]);
  return Buffer.from(bytes).toString('base64');
}

test('POST /api/v1/documents/cv/upload rejects non-PDF extension', async () => {
  const token = await getValidToken('usr_candidate_a');
  const req = new Request('https://api.jobpilot.app/api/v1/documents/cv/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: 'curriculum.docx',
      file_base64: createSamplePdfBase64(),
    }),
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.strictEqual(res.status, 400);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'INVALID_FILE_TYPE');
});

test('POST /api/v1/documents/cv/upload rejects file with invalid magic bytes (fake PDF header)', async () => {
  const token = await getValidToken('usr_candidate_a');
  // Starts with 'PK\x03\x04' (ZIP header) instead of '%PDF-'
  const fakeBytes = Buffer.from('PK\x03\x04SomeZIPData').toString('base64');

  const req = new Request('https://api.jobpilot.app/api/v1/documents/cv/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: 'fake_cv.pdf',
      file_base64: fakeBytes,
    }),
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.strictEqual(res.status, 400);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'INVALID_FILE_FORMAT');
});

test('POST /api/v1/documents/cv/upload successfully validates, stores in R2 & D1, returns 201', async () => {
  const token = await getValidToken('usr_candidate_a');
  const pdfB64 = createSamplePdfBase64();

  const req = new Request('https://api.jobpilot.app/api/v1/documents/cv/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: 'alex_martin_cv.pdf',
      file_base64: pdfB64,
      target_country: 'CA',
      language: 'fr',
      version_name: 'Lead Mobile Architect - CA',
    }),
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.strictEqual(res.status, 201);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.user_id, 'usr_candidate_a');
  assert.strictEqual(json.data.original_filename, 'alex_martin_cv.pdf');
  assert.strictEqual(json.data.file_format, 'PDF');
  assert.strictEqual(json.data.target_country, 'CA');
  assert.strictEqual(json.data.language, 'fr');
  assert.ok(json.data.sha256_checksum);
  assert.strictEqual(json.data.sha256_checksum.length, 64);
  assert.ok(json.data.r2_storage_key);

  // Verify stored in Mock R2
  assert.strictEqual(mockBucket.has(json.data.r2_storage_key), true);

  // Verify stored in Mock D1
  const docId = json.data.id;
  assert.strictEqual(mockDb.records.has(docId), true);
});

test('GET /api/v1/documents/cv returns all documents for authenticated user', async () => {
  const token = await getValidToken('usr_candidate_a');
  const req = new Request('https://api.jobpilot.app/api/v1/documents/cv', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(Array.isArray(json.data), true);
  assert.ok(json.data.length >= 1);
  assert.strictEqual(json.data[0].user_id, 'usr_candidate_a');
});

test('Enforces multi-tenant data isolation: User B cannot access User A document', async () => {
  // Candidate A has an existing doc in mockDb
  const docA = Array.from(mockDb.records.values()).find(d => d.user_id === 'usr_candidate_a');
  assert.ok(docA, 'Precondition: Candidate A must have a document');

  // Candidate B attempts to fetch Candidate A's document
  const tokenB = await getValidToken('usr_candidate_b');
  const req = new Request(`https://api.jobpilot.app/api/v1/documents/cv/${docA.id}`, {
    headers: {
      Authorization: `Bearer ${tokenB}`,
    },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.strictEqual(res.status, 403);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'FORBIDDEN');
});

test('Enforces multi-tenant data isolation: User B cannot delete User A document', async () => {
  const docA = Array.from(mockDb.records.values()).find(d => d.user_id === 'usr_candidate_a');
  assert.ok(docA);

  const tokenB = await getValidToken('usr_candidate_b');
  const req = new Request(`https://api.jobpilot.app/api/v1/documents/cv/${docA.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${tokenB}`,
    },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.strictEqual(res.status, 403);
  const json = await res.json() as any;
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error.code, 'FORBIDDEN');

  // Verify document was NOT deleted
  assert.strictEqual(mockDb.records.has(docA.id), true);
});

test('Candidate A can safely delete their own CV document', async () => {
  const docA = Array.from(mockDb.records.values()).find(d => d.user_id === 'usr_candidate_a');
  assert.ok(docA);

  const tokenA = await getValidToken('usr_candidate_a');
  const req = new Request(`https://api.jobpilot.app/api/v1/documents/cv/${docA.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${tokenA}`,
    },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.deleted, true);

  // Document now removed from D1 & R2
  assert.strictEqual(mockDb.records.has(docA.id), false);
  assert.strictEqual(mockBucket.has(docA.r2_storage_key), false);
});
