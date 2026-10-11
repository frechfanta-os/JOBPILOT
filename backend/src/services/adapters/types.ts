import { Env } from '../../types/env.js';
import { JobListing, JobProviderStatus, JobSearchQuery } from '../../types/domain.js';

export interface AdapterSearchResult {
  provider: string;
  status: 'ACTIVE' | 'BLOCKED' | 'NOT_CONFIGURED' | 'FAILED';
  errorMessage?: string;
  items: JobListing[];
  totalCount?: number;
}

export interface JobSourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly coverage: string;
  readonly requiresAuth: boolean;

  /**
   * Returns current operational status of the adapter (ACTIVE, BLOCKED, etc.)
   */
  getStatus(env: Env): Promise<JobProviderStatus>;

  /**
   * Executes job search or discovery query with bounded timeout and retries.
   */
  search(query: JobSearchQuery, env: Env): Promise<AdapterSearchResult>;
}
