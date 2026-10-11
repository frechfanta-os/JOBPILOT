import { Env } from '../types/env.js';
import { JobListing, JobProviderStatus, JobSearchQuery } from '../types/domain.js';
import { JobSourceAdapter } from './adapters/types.js';
import { RemotiveJobAdapter } from './adapters/remotive.js';
import { ArbeitnowJobAdapter } from './adapters/arbeitnow.js';
import { AdzunaJobAdapter } from './adapters/adzuna.js';
import { JoobleJobAdapter } from './adapters/jooble.js';

export class JobIngestionService {
  private adapters: JobSourceAdapter[];

  constructor(customAdapters?: JobSourceAdapter[]) {
    this.adapters = customAdapters || [
      new RemotiveJobAdapter(),
      new ArbeitnowJobAdapter(),
      new AdzunaJobAdapter(),
      new JoobleJobAdapter(),
    ];
  }

  /**
   * Returns current operational readiness of all registered adapters.
   */
  async getProviderStatuses(env: Env): Promise<JobProviderStatus[]> {
    return Promise.all(this.adapters.map(a => a.getStatus(env)));
  }

  /**
   * Dispatches search across ready adapters, deduplicates results,
   * idempotently persists them in D1 if available, and returns normalized items.
   */
  async discoverAndIngest(query: JobSearchQuery, env: Env): Promise<{
    items: JobListing[];
    total: number;
    source_providers: JobProviderStatus[];
  }> {
    const statuses = await this.getProviderStatuses(env);
    const activeAdapters = this.adapters.filter((adapter, idx) => statuses[idx].status === 'ACTIVE');

    const searchPromises = activeAdapters.map(adapter => adapter.search(query, env));
    const results = await Promise.allSettled(searchPromises);

    const aggregatedJobs: JobListing[] = [];
    const seenHashes = new Set<string>();

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.status === 'ACTIVE') {
        for (const job of res.value.items) {
          if (!seenHashes.has(job.content_hash)) {
            seenHashes.add(job.content_hash);
            aggregatedJobs.push(job);
          }
        }
      }
    }

    // Sort by publication date (most recent first)
    aggregatedJobs.sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });

    // Idempotent upsert into D1 database if present
    if (env.DB && typeof env.DB.prepare === 'function' && aggregatedJobs.length > 0) {
      await this.persistJobsToD1(aggregatedJobs, env.DB);
    }

    // Apply pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const startIndex = (page - 1) * limit;
    const paginatedItems = aggregatedJobs.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total: aggregatedJobs.length,
      source_providers: statuses,
    };
  }

  /**
   * Persists a collection of jobs to D1 using ON CONFLICT upsert.
   */
  async persistJobsToD1(jobs: JobListing[], db: D1Database): Promise<void> {
    for (const job of jobs) {
      try {
        await db.prepare(
          `INSERT INTO job_listings (
            id, source_id, source_provider, source_attribution, title, company_name,
            country, city, province_or_region, is_remote, contract_type,
            salary_min, salary_max, currency, description_raw, description_summary,
            required_languages, required_skills, source_url, application_url,
            content_hash, status, published_at, retrieved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(content_hash) DO UPDATE SET
            status = excluded.status,
            retrieved_at = excluded.retrieved_at,
            source_url = excluded.source_url,
            application_url = COALESCE(excluded.application_url, job_listings.application_url)`
        ).bind(
          job.id,
          job.source_id,
          job.source_provider,
          job.source_attribution,
          job.title,
          job.company_name,
          job.country,
          job.city,
          job.province_or_region,
          job.is_remote ? 1 : 0,
          job.contract_type,
          job.salary_min ?? null,
          job.salary_max ?? null,
          job.currency,
          job.description_raw,
          job.description_summary ?? null,
          JSON.stringify(job.required_languages),
          JSON.stringify(job.required_skills),
          job.source_url,
          job.application_url ?? null,
          job.content_hash,
          job.status,
          job.published_at ?? null,
          job.retrieved_at
        ).run();
      } catch (err: any) {
        console.warn(`D1 upsert warning for job ${job.id}:`, err.message);
      }
    }
  }

  /**
   * Queries existing ingested jobs from D1, falling back to discovery if empty.
   */
  async searchJobs(query: JobSearchQuery, env: Env): Promise<{
    items: JobListing[];
    total: number;
    source_providers: JobProviderStatus[];
  }> {
    const statuses = await this.getProviderStatuses(env);

    if (env.DB && typeof env.DB.prepare === 'function') {
      try {
        const whereClauses: string[] = ["status = 'ACTIVE'"];
        const bindings: any[] = [];

        if (query.country && query.country !== 'ALL') {
          whereClauses.push('country = ?');
          bindings.push(query.country);
        }

        if (query.isRemote) {
          whereClauses.push('is_remote = 1');
        }

        if (query.query) {
          whereClauses.push('(title LIKE ? OR company_name LIKE ? OR description_raw LIKE ?)');
          const term = `%${query.query}%`;
          bindings.push(term, term, term);
        }

        if (query.location) {
          whereClauses.push('(city LIKE ? OR province_or_region LIKE ?)');
          const loc = `%${query.location}%`;
          bindings.push(loc, loc);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) as total FROM job_listings ${whereSql}`;
        const countResult = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();
        const total = countResult?.total || 0;

        if (total > 0) {
          const page = query.page || 1;
          const limit = Math.min(query.limit || 20, 50);
          const offset = (page - 1) * limit;

          const dataQuery = `SELECT * FROM job_listings ${whereSql} ORDER BY published_at DESC LIMIT ? OFFSET ?`;
          const rows = await env.DB.prepare(dataQuery).bind(...bindings, limit, offset).all<any>();

          const items: JobListing[] = (rows.results || []).map((r: any) => ({
            id: r.id,
            source_id: r.source_id,
            source_provider: r.source_provider,
            source_attribution: r.source_attribution || r.source_provider,
            title: r.title,
            company_name: r.company_name,
            country: r.country,
            city: r.city,
            province_or_region: r.province_or_region,
            is_remote: r.is_remote === 1,
            contract_type: r.contract_type,
            salary_min: r.salary_min,
            salary_max: r.salary_max,
            currency: r.currency,
            description_raw: r.description_raw,
            description_summary: r.description_summary,
            required_languages: typeof r.required_languages === 'string' ? JSON.parse(r.required_languages) : r.required_languages || [],
            required_skills: typeof r.required_skills === 'string' ? JSON.parse(r.required_skills) : r.required_skills || [],
            source_url: r.source_url,
            application_url: r.application_url,
            content_hash: r.content_hash,
            status: r.status,
            published_at: r.published_at,
            retrieved_at: r.retrieved_at,
          }));

          return { items, total, source_providers: statuses };
        }
      } catch (err: any) {
        console.warn('D1 query error in searchJobs:', err.message);
      }
    }

    // If D1 is empty or not configured, discover live from active adapters
    return this.discoverAndIngest(query, env);
  }
}
