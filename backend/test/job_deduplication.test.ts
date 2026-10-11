import test from 'node:test';
import assert from 'node:assert';
import { computeJobContentHash } from '../src/utils/hash.js';
import { sanitizeHtmlToPlainText, createSummarySnippet, normalizeStringForHash } from '../src/utils/sanitize.js';
import { JobIngestionService } from '../src/services/job_ingestion.js';
import { JobSourceAdapter, AdapterSearchResult } from '../src/services/adapters/types.js';
import { Env } from '../src/types/env.js';
import { JobListing, JobSearchQuery } from '../src/types/domain.js';

test('computeJobContentHash: normalizes whitespace and punctuation to detect identical listings', async () => {
  const hash1 = await computeJobContentHash(
    'Shopify, Inc.',
    'Senior Flutter Engineer (Remote)',
    'CA',
    'Ottawa, ON'
  );

  const hash2 = await computeJobContentHash(
    'shopify inc',
    'Senior Flutter Engineer Remote',
    'ca',
    'Ottawa ON'
  );

  assert.strictEqual(hash1, hash2, 'Normalized variations of the same listing must produce identical hashes');
  assert.strictEqual(hash1.length, 64, 'Must be a 64-char hex SHA-256 string');
});

test('computeJobContentHash: produces distinct hashes for different companies or locations', async () => {
  const hashCanada = await computeJobContentHash('Shopify', 'Lead Architect', 'CA', 'Toronto');
  const hashItaly = await computeJobContentHash('Shopify', 'Lead Architect', 'IT', 'Milano');

  assert.notStrictEqual(hashCanada, hashItaly);
});

test('sanitizeHtmlToPlainText: completely removes malicious scripts, styles, and tags', () => {
  const dirtyHtml = `
    <h1>Job Opening: Mobile Lead</h1>
    <script>alert("pwned")</script>
    <p>We are hiring! Salary: &euro;80,000 &amp; bonus.</p>
    <style>body { display: none; }</style>
    <a href="https://example.com" onclick="stealData()">Apply Here</a>
  `;

  const clean = sanitizeHtmlToPlainText(dirtyHtml);

  assert.strictEqual(clean.includes('<script>'), false);
  assert.strictEqual(clean.includes('alert("pwned")'), false);
  assert.strictEqual(clean.includes('<style>'), false);
  assert.strictEqual(clean.includes('<h1>'), false);
  assert.ok(clean.includes('Job Opening: Mobile Lead'));
  assert.ok(clean.includes('Salary: €80,000 & bonus.'));
  assert.ok(clean.includes('Apply Here'));
});

test('createSummarySnippet: trims long descriptions and appends ellipsis', () => {
  const longText = 'A'.repeat(500);
  const snippet = createSummarySnippet(longText, 100);

  assert.strictEqual(snippet.length, 103); // 100 chars + '...'
  assert.ok(snippet.endsWith('...'));
});

test('JobIngestionService: eliminates duplicate listings across adapters', async () => {
  const duplicateHash = await computeJobContentHash('Acme Corp', 'Developer', 'CA', 'Montreal');

  const sampleListingA: JobListing = {
    id: 'job_a_1',
    source_id: '1',
    source_provider: 'SOURCE_A',
    source_attribution: 'Source A',
    title: 'Developer',
    company_name: 'Acme Corp',
    country: 'CA',
    city: 'Montreal',
    province_or_region: 'QC',
    is_remote: true,
    contract_type: 'FULL_TIME',
    currency: 'CAD',
    description_raw: 'Description from A',
    required_languages: ['en'],
    required_skills: ['Dart'],
    source_url: 'https://example.com/job1',
    content_hash: duplicateHash,
    status: 'ACTIVE',
    retrieved_at: new Date().toISOString(),
  };

  const sampleListingB: JobListing = {
    id: 'job_b_2',
    source_id: '2',
    source_provider: 'SOURCE_B',
    source_attribution: 'Source B',
    title: 'Developer',
    company_name: 'Acme Corp',
    country: 'CA',
    city: 'Montreal',
    province_or_region: 'QC',
    is_remote: true,
    contract_type: 'FULL_TIME',
    currency: 'CAD',
    description_raw: 'Duplicate description from B',
    required_languages: ['en'],
    required_skills: ['Dart'],
    source_url: 'https://example.com/job2',
    content_hash: duplicateHash, // EXACT SAME HASH
    status: 'ACTIVE',
    retrieved_at: new Date().toISOString(),
  };

  const mockAdapterA: JobSourceAdapter = {
    id: 'mock_a',
    name: 'Mock A',
    coverage: 'CA',
    requiresAuth: false,
    getStatus: async () => ({ name: 'Mock A', coverage: 'CA', status: 'ACTIVE' }),
    search: async () => ({ provider: 'Mock A', status: 'ACTIVE', items: [sampleListingA] }),
  };

  const mockAdapterB: JobSourceAdapter = {
    id: 'mock_b',
    name: 'Mock B',
    coverage: 'CA',
    requiresAuth: false,
    getStatus: async () => ({ name: 'Mock B', coverage: 'CA', status: 'ACTIVE' }),
    search: async () => ({ provider: 'Mock B', status: 'ACTIVE', items: [sampleListingB] }),
  };

  const service = new JobIngestionService([mockAdapterA, mockAdapterB]);
  const result = await service.discoverAndIngest({ country: 'CA' }, {} as Env);

  // Even though both adapters returned a job, deduplication collapsed them into exactly 1
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].content_hash, duplicateHash);
});
