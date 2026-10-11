import { Env } from '../../types/env.js';
import { JobListing, JobProviderStatus, JobSearchQuery } from '../../types/domain.js';
import { JobSourceAdapter, AdapterSearchResult } from './types.js';
import { sanitizeHtmlToPlainText, createSummarySnippet } from '../../utils/sanitize.js';
import { computeJobContentHash } from '../../utils/hash.js';

interface RemotiveApiJob {
  id: number | string;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description: string;
}

interface RemotiveApiResponse {
  '00-warning'?: string;
  'job-count'?: number;
  jobs?: RemotiveApiJob[];
}

export class RemotiveJobAdapter implements JobSourceAdapter {
  readonly id = 'remotive';
  readonly name = 'Remotive';
  readonly coverage = 'Worldwide Remote (Canada & Italy/Europe eligible)';
  readonly requiresAuth = false;

  private static readonly API_URL = 'https://remotive.com/api/remote-jobs';
  private static readonly TIMEOUT_MS = 8000;

  async getStatus(_env: Env): Promise<JobProviderStatus> {
    return {
      name: this.name,
      coverage: this.coverage,
      status: 'ACTIVE',
    };
  }

  async search(query: JobSearchQuery, _env: Env): Promise<AdapterSearchResult> {
    try {
      const url = new URL(RemotiveJobAdapter.API_URL);
      if (query.query) {
        url.searchParams.set('search', query.query);
      }
      url.searchParams.set('limit', '50');

      // Fetch with timeout and bounded retry
      const response = await this.fetchWithRetry(url.toString(), 2);
      if (!response.ok) {
        return {
          provider: this.name,
          status: 'FAILED',
          errorMessage: `Remotive API responded with HTTP ${response.status}`,
          items: [],
        };
      }

      const data = (await response.json()) as RemotiveApiResponse;
      const rawJobs = data.jobs || [];

      const normalizedJobs: JobListing[] = [];
      const targetCountry = query.country || 'ALL';

      for (const raw of rawJobs) {
        const locationLower = (raw.candidate_required_location || '').toLowerCase();

        // Geographic filtering for Canada and Italy
        const isCanadaEligible =
          locationLower.includes('canada') ||
          locationLower.includes('north america') ||
          locationLower.includes('worldwide') ||
          locationLower.includes('anywhere') ||
          locationLower === '';

        const isItalyEligible =
          locationLower.includes('italy') ||
          locationLower.includes('italia') ||
          locationLower.includes('europe') ||
          locationLower.includes('eu') ||
          locationLower.includes('worldwide') ||
          locationLower.includes('anywhere') ||
          locationLower === '';

        let country: 'CA' | 'IT';
        if (targetCountry === 'CA') {
          if (!isCanadaEligible) continue;
          country = 'CA';
        } else if (targetCountry === 'IT') {
          if (!isItalyEligible) continue;
          country = 'IT';
        } else {
          // ALL
          if (locationLower.includes('canada')) country = 'CA';
          else if (locationLower.includes('italy') || locationLower.includes('italia')) country = 'IT';
          else if (isCanadaEligible) country = 'CA';
          else if (isItalyEligible) country = 'IT';
          else continue;
        }

        const city = raw.candidate_required_location || 'Remote';
        const contentHash = await computeJobContentHash(raw.company_name, raw.title, country, city);
        const cleanDescription = sanitizeHtmlToPlainText(raw.description);
        const summary = createSummarySnippet(cleanDescription, 300);

        // Parse salary numbers if available
        let salaryMin: number | undefined;
        let salaryMax: number | undefined;
        if (raw.salary) {
          const numbers = raw.salary.match(/\d[\d,\.]*/g);
          if (numbers && numbers.length >= 2) {
            salaryMin = parseInt(numbers[0].replace(/[,\.]/g, ''), 10);
            salaryMax = parseInt(numbers[1].replace(/[,\.]/g, ''), 10);
          } else if (numbers && numbers.length === 1) {
            salaryMin = parseInt(numbers[0].replace(/[,\.]/g, ''), 10);
          }
        }

        normalizedJobs.push({
          id: `job_remotive_${raw.id}`,
          source_id: String(raw.id),
          source_provider: 'REMOTIVE',
          source_attribution: 'Remotive (Official Remote Jobs API)',
          title: raw.title,
          company_name: raw.company_name,
          country,
          city,
          province_or_region: raw.candidate_required_location || 'Remote',
          is_remote: true,
          contract_type: (raw.job_type || 'full_time').toUpperCase(),
          salary_min: salaryMin,
          salary_max: salaryMax,
          currency: country === 'CA' ? 'CAD' : 'EUR',
          description_raw: cleanDescription,
          description_summary: summary,
          required_languages: country === 'CA' ? ['en'] : ['en', 'it'],
          required_skills: raw.category ? [raw.category] : [],
          source_url: raw.url,
          application_url: raw.url,
          content_hash: contentHash,
          status: 'ACTIVE',
          published_at: raw.publication_date,
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
        errorMessage: err?.name === 'TimeoutError' ? 'Remotive API request timed out' : err?.message || 'Failed to query Remotive',
        items: [],
      };
    }
  }

  private async fetchWithRetry(url: string, maxRetries: number): Promise<Response> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(RemotiveJobAdapter.TIMEOUT_MS),
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
