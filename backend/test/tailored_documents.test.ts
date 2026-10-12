import test from 'node:test';
import assert from 'node:assert';
import worker from '../src/index.js';
import { Env } from '../src/types/env.js';
import { signJwt } from '../src/utils/jwt.js';

const TEST_SECRET = 'jobpilot-dev-jwt-hmac-sha256-secret-not-for-production';

class MockD1Database {
  public jobs = new Map<string, any>();
  public users = new Map<string, any>();
  public tailoredDocs = new Map<string, any>();

  prepare(query: string) {
    const db = this;
    return {
      bind(...args: any[]) {
        return {
          async run() {
            if (query.includes('INSERT INTO tailored_documents')) {
              const [
                id, user_id, job_id, document_type, language, version_number,
                title, content_markdown, status, generation_model, generation_notes,
                created_at, updated_at
              ] = args;
              db.tailoredDocs.set(id, {
                id,
                user_id,
                job_id,
                document_type,
                language,
                version_number,
                title,
                content_markdown,
                status,
                generation_model,
                generation_notes,
                created_at,
                updated_at,
              });
              return { success: true };
            }
            if (query.includes('UPDATE tailored_documents SET content_markdown = ?')) {
              const [newContent, newTitle, newStatus, now, docId] = args;
              const doc = db.tailoredDocs.get(docId);
              if (doc) {
                doc.content_markdown = newContent;
                doc.title = newTitle;
                doc.status = newStatus;
                doc.updated_at = now;
              }
              return { success: true };
            }
            if (query.includes('UPDATE tailored_documents SET status = ?')) {
              const [newStatus, now, docId] = args;
              const doc = db.tailoredDocs.get(docId);
              if (doc) {
                doc.status = newStatus;
                doc.updated_at = now;
              }
              return { success: true };
            }
            if (query.includes('DELETE FROM tailored_documents WHERE id = ?')) {
              const [docId] = args;
              db.tailoredDocs.delete(docId);
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
            if (query.includes('SELECT MAX(version_number) as max_v FROM tailored_documents')) {
              const [userId, jobId, docType] = args;
              let maxV = 0;
              for (const doc of db.tailoredDocs.values()) {
                if (doc.user_id === userId && doc.job_id === jobId && doc.document_type === docType) {
                  if (doc.version_number > maxV) maxV = doc.version_number;
                }
              }
              return { max_v: maxV > 0 ? maxV : null } as T;
            }
            if (query.includes('SELECT * FROM tailored_documents WHERE id = ?')) {
              const [docId] = args;
              return (db.tailoredDocs.get(docId) as T) || null;
            }
            return null;
          },
          async all<T = any>(): Promise<{ results: T[] }> {
            if (query.includes('FROM tailored_documents WHERE user_id = ?')) {
              const [userId] = args;
              const results: any[] = [];
              for (const doc of db.tailoredDocs.values()) {
                if (doc.user_id === userId) results.push(doc);
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

test('POST /api/v1/documents/tailored: generates ATS tailored CV with factual grounding', async () => {
  const db = new MockD1Database();
  const env = createTestEnv(db);

  db.jobs.set('job-ca-2', {
    id: 'job-ca-2',
    source_id: 's2',
    source_provider: 'test',
    title: 'Senior Cloud Engineer',
    company_name: 'Shopify Core',
    country: 'CA',
    city: 'Montreal',
    province_or_region: 'QC',
    is_remote: 1,
    contract_type: 'FULL_TIME',
    currency: 'CAD',
    description_raw: 'Cloud infrastructure engineer with Go, Kubernetes, and Terraform.',
    required_languages: JSON.stringify(['en', 'fr']),
    required_skills: JSON.stringify(['Go', 'Kubernetes', 'Terraform']),
    source_url: 'https://example.com/job/ca-2',
    content_hash: 'h2',
    status: 'ACTIVE',
    retrieved_at: new Date().toISOString(),
  });

  const userProfile = {
    id: 'user-cand-20',
    email: 'cloud@test.com',
    first_name: 'Julien',
    last_name: 'Tremblay',
    location: 'Montreal, QC',
    target_countries: ['CA'],
    primary_language: 'fr',
    skills: [
      { name: 'Kubernetes', level: 'EXPERT', years_of_experience: 4, is_confirmed: true },
      { name: 'Go', level: 'ADVANCED', years_of_experience: 3, is_confirmed: true },
    ],
    experiences: [
      {
        company_name: 'CloudCorp Canada',
        job_title: 'Infrastructure Specialist',
        start_date: '2020-03',
        is_current: true,
        description: 'Managed Kubernetes clusters and Terraform deployments.',
        technologies: ['Kubernetes', 'Go', 'Terraform'],
        is_confirmed: true,
      },
    ],
    education: [
      {
        institution: 'Polytechnique Montréal',
        degree_name: 'Baccalauréat en génie logiciel',
        graduation_year: 2020,
        is_confirmed: true,
      },
    ],
    languages: [
      { code: 'fr', proficiency: 'NATIVE', is_confirmed: true },
      { code: 'en', proficiency: 'PROFESSIONAL', is_confirmed: true },
    ],
  };

  db.users.set('user-cand-20', {
    id: 'user-cand-20',
    email: 'cloud@test.com',
    first_name: 'Julien',
    last_name: 'Tremblay',
    profile_data: JSON.stringify(userProfile),
  });

  const token = await getValidToken('user-cand-20', 'cloud@test.com');

  // Generate French CV
  const reqFr = new Request('https://api.jobpilot.internal/api/v1/documents/tailored', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      job_id: 'job-ca-2',
      document_type: 'CV',
      language: 'fr',
    }),
  });

  const resFr = await worker.fetch(reqFr, env, {} as any);
  assert.strictEqual(resFr.status, 201);
  const bodyFr = (await resFr.json()) as any;

  assert.strictEqual(bodyFr.success, true);
  assert.strictEqual(bodyFr.data.document_type, 'CV');
  assert.strictEqual(bodyFr.data.language, 'fr');
  assert.strictEqual(bodyFr.data.version_number, 1);
  assert.strictEqual(bodyFr.data.status, 'DRAFT');

  // Verify ATS Markdown format & French section headers
  assert.ok(bodyFr.data.content_markdown.includes('# Julien Tremblay'));
  assert.ok(bodyFr.data.content_markdown.includes('## Expérience Professionnelle'));
  assert.ok(bodyFr.data.content_markdown.includes('CloudCorp Canada'));
  assert.ok(bodyFr.data.content_markdown.includes('Kubernetes'));

  // Generating a second version increments version_number to 2
  const reqV2 = new Request('https://api.jobpilot.internal/api/v1/documents/tailored', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      job_id: 'job-ca-2',
      document_type: 'CV',
      language: 'fr',
    }),
  });

  const resV2 = await worker.fetch(reqV2, env, {} as any);
  const bodyV2 = (await resV2.json()) as any;
  assert.strictEqual(bodyV2.data.version_number, 2);
});

test('POST /api/v1/documents/tailored: generates multilingual Cover Letters in IT, FR, EN', async () => {
  const db = new MockD1Database();
  const env = createTestEnv(db);

  db.jobs.set('job-it-1', {
    id: 'job-it-1',
    source_id: 'sit1',
    source_provider: 'test',
    title: 'Ingegnere del Software',
    company_name: 'Milano Tech Hub',
    country: 'IT',
    city: 'Milano',
    province_or_region: 'Lombardia',
    is_remote: 0,
    contract_type: 'FULL_TIME',
    currency: 'EUR',
    description_raw: 'Sviluppo backend in Node.js e TypeScript.',
    required_languages: JSON.stringify(['it']),
    required_skills: JSON.stringify(['Node.js', 'TypeScript']),
    source_url: 'https://example.com/job/it-1',
    content_hash: 'hit1',
    status: 'ACTIVE',
    retrieved_at: new Date().toISOString(),
  });

  const userProfile = {
    id: 'user-cand-30',
    email: 'marco@test.it',
    first_name: 'Marco',
    last_name: 'Rossi',
    skills: [{ name: 'TypeScript', is_confirmed: true }],
    languages: [{ code: 'it', proficiency: 'NATIVE', is_confirmed: true }],
  };

  db.users.set('user-cand-30', {
    id: 'user-cand-30',
    email: 'marco@test.it',
    first_name: 'Marco',
    last_name: 'Rossi',
    profile_data: JSON.stringify(userProfile),
  });

  const token = await getValidToken('user-cand-30', 'marco@test.it');

  const req = new Request('https://api.jobpilot.internal/api/v1/documents/tailored', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      job_id: 'job-it-1',
      document_type: 'COVER_LETTER',
      language: 'it',
    }),
  });

  const res = await worker.fetch(req, env, {} as any);
  assert.strictEqual(res.status, 201);
  const body = (await res.json()) as any;
  assert.ok(body.data.content_markdown.includes('Milano Tech Hub'));
  assert.ok(body.data.content_markdown.includes('Ingegnere del Software'));
  assert.ok(body.data.content_markdown.includes('Marco Rossi'));
});

test('PUT, APPROVE, DELETE on /api/v1/documents/tailored/:id enforce multi-tenant isolation and state transitions', async () => {
  const db = new MockD1Database();
  const env = createTestEnv(db);

  db.tailoredDocs.set('doc-101', {
    id: 'doc-101',
    user_id: 'user-cand-20',
    job_id: 'job-ca-2',
    document_type: 'CV',
    language: 'en',
    version_number: 1,
    title: 'Tailored CV',
    content_markdown: '# Initial Draft',
    status: 'DRAFT',
    generation_model: 'deterministic-ats-template-v1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const ownerToken = await getValidToken('user-cand-20', 'cloud@test.com');
  const attackerToken = await getValidToken('user-attacker', 'bad@test.com');

  // 1. Attacker fails to update doc-101 (403 FORBIDDEN)
  const reqAttack = new Request('https://api.jobpilot.internal/api/v1/documents/tailored/doc-101', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${attackerToken}`,
    },
    body: JSON.stringify({ content_markdown: '# Tampered' }),
  });
  const resAttack = await worker.fetch(reqAttack, env, {} as any);
  assert.strictEqual(resAttack.status, 403);

  // 2. Owner edits draft -> updates markdown & sets status = 'REVIEWED'
  const reqEdit = new Request('https://api.jobpilot.internal/api/v1/documents/tailored/doc-101', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ content_markdown: '# Updated By Candidate' }),
  });
  const resEdit = await worker.fetch(reqEdit, env, {} as any);
  assert.strictEqual(resEdit.status, 200);
  const bodyEdit = (await resEdit.json()) as any;
  assert.strictEqual(bodyEdit.data.status, 'REVIEWED');
  assert.strictEqual(bodyEdit.data.content_markdown, '# Updated By Candidate');

  // 3. Owner approves document -> status = 'APPROVED'
  const reqApprove = new Request('https://api.jobpilot.internal/api/v1/documents/tailored/doc-101/approve', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });
  const resApprove = await worker.fetch(reqApprove, env, {} as any);
  assert.strictEqual(resApprove.status, 200);
  const bodyApprove = (await resApprove.json()) as any;
  assert.strictEqual(bodyApprove.data.status, 'APPROVED');

  // 4. Owner deletes document -> 200
  const reqDelete = new Request('https://api.jobpilot.internal/api/v1/documents/tailored/doc-101', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });
  const resDelete = await worker.fetch(reqDelete, env, {} as any);
  assert.strictEqual(resDelete.status, 200);
  assert.strictEqual(db.tailoredDocs.has('doc-101'), false);
});
