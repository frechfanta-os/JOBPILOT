import { Env } from '../types/env.js';
import { createSuccessResponse, createErrorResponse } from '../types/api.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { JobSearchQuery } from '../types/domain.js';
import { JobIngestionService } from '../services/job_ingestion.js';

const ingestionService = new JobIngestionService();

export async function handleJobs(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // 1. GET /api/v1/jobs/:id
  const singleJobMatch = pathname.match(/^\/api\/v1\/jobs\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && singleJobMatch) {
    const jobId = singleJobMatch[1];
    return handleGetJobById(jobId, env, correlationId);
  }

  // 2. POST /api/v1/jobs/sync
  if (method === 'POST' && pathname === '/api/v1/jobs/sync') {
    return handleSyncJobs(request, env, correlationId);
  }

  // 3. GET /api/v1/jobs or /api/v1/jobs/search
  if (method === 'GET') {
    return handleSearchJobs(url, env, correlationId);
  }

  return new Response(
    JSON.stringify(createErrorResponse('METHOD_NOT_ALLOWED', `Method ${method} not allowed`, undefined, correlationId)),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleSearchJobs(url: URL, env: Env, correlationId: string): Promise<Response> {
  const rawCountry = url.searchParams.get('country') || 'ALL';
  const query = url.searchParams.get('q') || '';
  const location = url.searchParams.get('location') || '';
  const isRemote = url.searchParams.get('remote') === 'true';
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
  const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);

  // Parameter validation
  if (rawCountry !== 'ALL' && rawCountry !== 'CA' && rawCountry !== 'IT') {
    return new Response(
      JSON.stringify(createErrorResponse('INVALID_PARAMETER', 'Country must be one of: CA, IT, ALL', undefined, correlationId)),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(limitParam, 50);

  const searchQuery: JobSearchQuery = {
    country: rawCountry as any,
    query: query.substring(0, 100),
    location: location.substring(0, 100),
    isRemote,
    page,
    limit,
  };

  try {
    const searchResult = await ingestionService.searchJobs(searchQuery, env);
    const hasMore = page * limit < searchResult.total;

    return new Response(
      JSON.stringify(
        createSuccessResponse(
          {
            items: searchResult.items,
            total: searchResult.total,
            page,
            limit,
            has_more: hasMore,
            source_providers: searchResult.source_providers,
          },
          correlationId
        )
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify(
        createErrorResponse('SEARCH_FAILED', err?.message || 'Failed to search job listings', undefined, correlationId)
      ),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetJobById(jobId: string, env: Env, correlationId: string): Promise<Response> {
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const row = await env.DB.prepare('SELECT * FROM job_listings WHERE id = ?').bind(jobId).first<any>();
      if (row) {
        const job = {
          id: row.id,
          source_id: row.source_id,
          source_provider: row.source_provider,
          source_attribution: row.source_attribution || row.source_provider,
          title: row.title,
          company_name: row.company_name,
          country: row.country,
          city: row.city,
          province_or_region: row.province_or_region,
          is_remote: row.is_remote === 1,
          contract_type: row.contract_type,
          salary_min: row.salary_min,
          salary_max: row.salary_max,
          currency: row.currency,
          description_raw: row.description_raw,
          description_summary: row.description_summary,
          required_languages: typeof row.required_languages === 'string' ? JSON.parse(row.required_languages) : row.required_languages || [],
          required_skills: typeof row.required_skills === 'string' ? JSON.parse(row.required_skills) : row.required_skills || [],
          source_url: row.source_url,
          application_url: row.application_url,
          content_hash: row.content_hash,
          status: row.status,
          published_at: row.published_at,
          retrieved_at: row.retrieved_at,
        };

        return new Response(JSON.stringify(createSuccessResponse(job, correlationId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err: any) {
      console.warn('D1 getJobById error:', err.message);
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('NOT_FOUND', `Job listing ${jobId} not found`, undefined, correlationId)),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleSyncJobs(request: Request, env: Env, correlationId: string): Promise<Response> {
  try {
    const result = await ingestionService.discoverAndIngest({ country: 'ALL', limit: 50 }, env);
    return new Response(
      JSON.stringify(
        createSuccessResponse(
          {
            synced_count: result.total,
            providers: result.source_providers,
          },
          correlationId
        )
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify(createErrorResponse('SYNC_FAILED', err?.message || 'Failed to sync job feeds', undefined, correlationId)),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
