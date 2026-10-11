import { Env } from '../../types/env.js';
import { JobListing, JobProviderStatus, JobSearchQuery } from '../../types/domain.js';
import { JobSourceAdapter, AdapterSearchResult } from './types.js';
import { sanitizeHtmlToPlainText, createSummarySnippet } from '../../utils/sanitize.js';
import { computeJobContentHash } from '../../utils/hash.js';

interface JoobleJob {
  id: string | number;
  title: string;
  location: string;
  snippet: string;
  salary: string;
  source: string;
  type: string;
  link: string;
  company: string;
  updated: string;
}

interface JoobleApiResponse {
  totalCount?: number;
  jobs?: JoobleJob[];
}

export class JoobleJobAdapter implements JobSourceAdapter {
  readonly id = 'jooble';
  readonly name = 'Jooble';
  readonly coverage = 'Aggregated Global Feeds (Canada & Italy)';
  readonly requiresAuth = true;

  private static readonly TIMEOUT_MS = 8000;

  async getStatus(env: Env): Promise<JobProviderStatus> {
    const hasKey = Boolean(env.JOOBLE_API_KEY);
    return {
      name: this.name,
      coverage: this.coverage,
      status: hasKey ? 'ACTIVE' : 'BLOCKED',
      reason: hasKey ? undefined : 'Jooble API key not configured. Requires JOOBLE_API_KEY.',
    };
  }

  async search(query: JobSearchQuery, env: Env): Promise<AdapterSearchResult> {
    const apiKey = env.JOOBLE_API_KEY;

    if (!apiKey) {
      return {
        provider: this.name,
        status: 'BLOCKED',
        errorMessage: 'Jooble API key not configured. Please supply JOOBLE_API_KEY.',
        items: [],
      };
    }

    try {
      const url = `https://jooble.org/api/${apiKey}`;
      const targetCountry = (query.country === 'IT' ? 'IT' : 'CA') as 'CA' | 'IT';
      const location = query.location || (targetCountry === 'CA' ? 'Canada' : 'Italy');

      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(JoobleJobAdapter.TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          keywords: query.query || 'software',
          location,
          page: query.page || 1,
        }),
      });

      if (!response.ok) {
        return {
          provider: this.name,
          status: 'FAILED',
          errorMessage: `Jooble API returned HTTP ${response.status}`,
          items: [],
        };
      }

      const data = (await response.json()) as JoobleApiResponse;
      const rawJobs = data.jobs || [];
      const normalizedJobs: JobListing[] = [];

      for (const raw of rawJobs) {
        const city = raw.location || location;
        const contentHash = await computeJobContentHash(raw.company, raw.title, targetCountry, city);
        const cleanSnippet = sanitizeHtmlToPlainText(raw.snippet);

        normalizedJobs.push({
          id: `job_jooble_${raw.id}`,
          source_id: String(raw.id),
          source_provider: 'JOOBLE',
          source_attribution: `Jooble (${raw.source || 'Aggregated'})`,
          title: raw.title,
          company_name: raw.company || 'Organization',
          country: targetCountry,
          city,
          province_or_region: location,
          is_remote: raw.title.toLowerCase().includes('remote') || cleanSnippet.toLowerCase().includes('remote'),
          contract_type: (raw.type || 'FULL_TIME').toUpperCase().replace(/\s+/g, '_'),
          currency: targetCountry === 'CA' ? 'CAD' : 'EUR',
          description_raw: cleanSnippet,
          description_summary: createSummarySnippet(cleanSnippet, 300),
          required_languages: targetCountry === 'CA' ? ['en'] : ['it'],
          required_skills: [],
          source_url: raw.link,
          application_url: raw.link,
          content_hash: contentHash,
          status: 'ACTIVE',
          published_at: raw.updated,
          retrieved_at: new Date().toISOString(),
        });
      }

      return {
        provider: this.name,
        status: 'ACTIVE',
        items: normalizedJobs,
        totalCount: data.totalCount,
      };
    } catch (err: any) {
      return {
        provider: this.name,
        status: 'FAILED',
        errorMessage: err?.message || 'Failed to query Jooble API',
        items: [],
      };
    }
  }
}
