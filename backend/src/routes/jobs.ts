import { Env } from '../types/env.js';
import { createSuccessResponse, createErrorResponse } from '../types/api.js';
import { AuthenticatedUser } from '../middleware/auth.js';

export async function handleJobs(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const country = url.searchParams.get('country') || 'ALL';
    const query = url.searchParams.get('q') || '';
    const isRemote = url.searchParams.get('remote') === 'true';

    // In Phase 2 Foundation, return contract-compliant feed structure
    const feed = {
      query: { country, query, isRemote },
      total_count: 0,
      results: [],
      source_providers_status: {
        job_bank_ca: 'READY_PHASE_3',
        adzuna_ca: 'CONFIG_PENDING',
        adzuna_it: 'CONFIG_PENDING',
      },
    };

    return new Response(JSON.stringify(createSuccessResponse(feed, correlationId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify(createErrorResponse('METHOD_NOT_ALLOWED', `Method ${request.method} not allowed`, undefined, correlationId)),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
