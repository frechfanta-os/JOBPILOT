import { Env } from '../../types/env.js';
import { JobListing, JobProviderStatus, JobSearchQuery } from '../../types/domain.js';
import { JobSourceAdapter, AdapterSearchResult } from './types.js';
import { sanitizeHtmlToPlainText, createSummarySnippet } from '../../utils/sanitize.js';
import { computeJobContentHash } from '../../utils/hash.js';

interface AdzunaJob {
  id: string | number;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
  created: string;
}

interface AdzunaApiResponse {
  results?: AdzunaJob[];
  count?: number;
}

export class AdzunaJobAdapter implements JobSourceAdapter {
  readonly id = 'adzuna';
  readonly name = 'Adzuna';
  readonly coverage = 'Direct Regional Feeds (Canada & Italy)';
  readonly requiresAuth = true;

  private static readonly TIMEOUT_MS = 8000;

  async getStatus(env: Env): Promise<JobProviderStatus> {
    const hasKeys = Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY);
    return {
      name: this.name,
      coverage: this.coverage,
      status: hasKeys ? 'ACTIVE' : 'BLOCKED',
      reason: hasKeys ? undefined : 'Adzuna developer credentials not configured. Requires ADZUNA_APP_ID and ADZUNA_APP_KEY.',
    };
  }

  async search(query: JobSearchQuery, env: Env): Promise<AdapterSearchResult> {
    const appId = env.ADZUNA_APP_ID;
    const appKey = env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      return {
        provider: this.name,
        status: 'BLOCKED',
        errorMessage: 'Adzuna API credentials not configured. Please supply ADZUNA_APP_ID and ADZUNA_APP_KEY.',
        items: [],
      };
    }

    try {
      const countryCode = query.country === 'IT' ? 'it' : 'ca';
      const page = query.page || 1;
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${countryCode}/search/${page}`);
      url.searchParams.set('app_id', appId);
      url.searchParams.set('app_key', appKey);
      url.searchParams.set('results_per_page', '20');
      if (query.query) url.searchParams.set('what', query.query);
      if (query.location) url.searchParams.set('where', query.location);

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(AdzunaJobAdapter.TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return {
          provider: this.name,
          status: 'FAILED',
          errorMessage: `Adzuna API returned HTTP ${response.status}`,
          items: [],
        };
      }

      const data = (await response.json()) as AdzunaApiResponse;
      const rawJobs = data.results || [];
      const normalizedJobs: JobListing[] = [];
      const targetCountry = countryCode.toUpperCase() as 'CA' | 'IT';

      for (const raw of rawJobs) {
        const companyName = raw.company?.display_name || 'Organization';
        const city = raw.location?.display_name || (targetCountry === 'CA' ? 'Montreal' : 'Milano');
        const contentHash = await computeJobContentHash(companyName, raw.title, targetCountry, city);
        const cleanDescription = sanitizeHtmlToPlainText(raw.description);

        normalizedJobs.push({
          id: `job_adzuna_${raw.id}`,
          source_id: String(raw.id),
          source_provider: 'ADZUNA',
          source_attribution: `Adzuna ${targetCountry} (Official Job Index)`,
          title: raw.title,
          company_name: companyName,
          country: targetCountry,
          city,
          province_or_region: raw.location?.area?.[0] || '',
          is_remote: raw.title.toLowerCase().includes('remote') || cleanDescription.toLowerCase().includes('remote'),
          contract_type: (raw.contract_type || 'FULL_TIME').toUpperCase(),
          salary_min: raw.salary_min,
          salary_max: raw.salary_max,
          currency: targetCountry === 'CA' ? 'CAD' : 'EUR',
          description_raw: cleanDescription,
          description_summary: createSummarySnippet(cleanDescription, 300),
          required_languages: targetCountry === 'CA' ? ['en', 'fr'] : ['it'],
          required_skills: [],
          source_url: raw.redirect_url,
          application_url: raw.redirect_url,
          content_hash: contentHash,
          status: 'ACTIVE',
          published_at: raw.created,
          retrieved_at: new Date().toISOString(),
        });
      }

      return {
        provider: this.name,
        status: 'ACTIVE',
        items: normalizedJobs,
        totalCount: data.count,
      };
    } catch (err: any) {
      return {
        provider: this.name,
        status: 'FAILED',
        errorMessage: err?.message || 'Failed to query Adzuna API',
        items: [],
      };
    }
  }
}
