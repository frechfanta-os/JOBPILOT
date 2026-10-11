import { Env } from '../../types/env.js';
import { JobListing, JobProviderStatus, JobSearchQuery } from '../../types/domain.js';
import { JobSourceAdapter, AdapterSearchResult } from './types.js';
import { sanitizeHtmlToPlainText, createSummarySnippet } from '../../utils/sanitize.js';
import { computeJobContentHash } from '../../utils/hash.js';

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at: number; // Unix timestamp in seconds
}

interface ArbeitnowApiResponse {
  data?: ArbeitnowJob[];
  links?: { next?: string };
}

export class ArbeitnowJobAdapter implements JobSourceAdapter {
  readonly id = 'arbeitnow';
  readonly name = 'Arbeitnow';
  readonly coverage = 'European Union & Remote (Italy eligible)';
  readonly requiresAuth = false;

  private static readonly API_URL = 'https://www.arbeitnow.com/api/job-board-api';
  private static readonly TIMEOUT_MS = 8000;

  async getStatus(_env: Env): Promise<JobProviderStatus> {
    return {
      name: this.name,
      coverage: this.coverage,
      status: 'ACTIVE',
    };
  }

  async search(query: JobSearchQuery, _env: Env): Promise<AdapterSearchResult> {
    // Arbeitnow is primarily European; skip if user explicitly requested Canada only
    if (query.country === 'CA') {
      return {
        provider: this.name,
        status: 'ACTIVE',
        items: [],
        totalCount: 0,
      };
    }

    try {
      const url = new URL(ArbeitnowJobAdapter.API_URL);
      if (query.page && query.page > 1) {
        url.searchParams.set('page', String(query.page));
      }

      const response = await this.fetchWithRetry(url.toString(), 2);
      if (!response.ok) {
        return {
          provider: this.name,
          status: 'FAILED',
          errorMessage: `Arbeitnow API responded with HTTP ${response.status}`,
          items: [],
        };
      }

      const data = (await response.json()) as ArbeitnowApiResponse;
      const rawJobs = data.data || [];

      const normalizedJobs: JobListing[] = [];

      for (const raw of rawJobs) {
        const locationLower = (raw.location || '').toLowerCase();
        const titleLower = raw.title.toLowerCase();

        // Check if matching query keyword
        if (query.query) {
          const qLower = query.query.toLowerCase();
          const matchTitle = titleLower.includes(qLower);
          const matchCompany = raw.company_name.toLowerCase().includes(qLower);
          const matchTags = (raw.tags || []).some(t => t.toLowerCase().includes(qLower));
          if (!matchTitle && !matchCompany && !matchTags) {
            continue;
          }
        }

        // Italian or Remote eligibility check
        const isItaly = locationLower.includes('italy') || locationLower.includes('italia') || locationLower.includes('milan') || locationLower.includes('rome');
        const isEligible = isItaly || raw.remote || locationLower.includes('remote') || locationLower.includes('europe');
        if (!isEligible) continue;

        const city = raw.location || (raw.remote ? 'Remote' : 'Europe');
        const country = 'IT';
        const contentHash = await computeJobContentHash(raw.company_name, raw.title, country, city);
        const cleanDescription = sanitizeHtmlToPlainText(raw.description);
        const summary = createSummarySnippet(cleanDescription, 300);

        const publishedIso = new Date(raw.created_at * 1000).toISOString();

        normalizedJobs.push({
          id: `job_arbeitnow_${raw.slug}`,
          source_id: raw.slug,
          source_provider: 'ARBEITNOW',
          source_attribution: 'Arbeitnow (European Job Board API)',
          title: raw.title,
          company_name: raw.company_name,
          country,
          city,
          province_or_region: raw.location || 'Europe',
          is_remote: raw.remote,
          contract_type: (raw.job_types?.[0] || 'FULL_TIME').toUpperCase().replace(/\s+/g, '_'),
          currency: 'EUR',
          description_raw: cleanDescription,
          description_summary: summary,
          required_languages: isItaly ? ['it', 'en'] : ['en'],
          required_skills: raw.tags || [],
          source_url: raw.url,
          application_url: raw.url,
          content_hash: contentHash,
          status: 'ACTIVE',
          published_at: publishedIso,
          retrieved_at: new Date().toISOString(),
        });
      }

      return {
        provider: this.name,
        status: 'ACTIVE',
        items: normalizedJobs,
        totalCount: normalizedJobs.length,
      };
    } catch (err: any) {
      return {
        provider: this.name,
        status: 'FAILED',
        errorMessage: err?.name === 'TimeoutError' ? 'Arbeitnow API request timed out' : err?.message || 'Failed to query Arbeitnow',
        items: [],
      };
    }
  }

  private async fetchWithRetry(url: string, maxRetries: number): Promise<Response> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(ArbeitnowJobAdapter.TIMEOUT_MS),
          headers: {
            'User-Agent': 'JobPilot-International-Assistant/1.0 (+https://github.com/frechfanta-os/JOBPILOT)',
            Accept: 'application/json',
          },
        });
        if (response.status < 500) {
          return response;
        }
      } catch (err) {
        lastError = err;
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastError || new Error(`Failed after ${maxRetries} retries`);
  }
}
