import { Env } from '../types/env.js';
import { createSuccessResponse, createErrorResponse } from '../types/api.js';
import { AuthenticatedUser } from '../middleware/auth.js';

export async function handleApplications(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (request.method === 'GET') {
    return new Response(
      JSON.stringify(
        createSuccessResponse(
          {
            total: 0,
            applications: [],
            pipeline_summary: {
              discovered: 0,
              analyzed: 0,
              ready_for_review: 0,
              approved: 0,
              submission_pending: 0,
              submitted: 0,
              closed: 0,
            },
          },
          correlationId
        )
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (request.method === 'POST') {
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (!idempotencyKey) {
      return new Response(
        JSON.stringify(
          createErrorResponse(
            'MISSING_IDEMPOTENCY_KEY',
            'Mutating application requests require a unique X-Idempotency-Key header.',
            undefined,
            correlationId
          )
        ),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const payload = await request.json() as any;
      return new Response(
        JSON.stringify(
          createSuccessResponse(
            {
              id: crypto.randomUUID(),
              user_id: user.userId,
              job_id: payload.job_id || 'sample_job_id',
              current_state: 'DISCOVERED',
              idempotency_key: idempotencyKey,
              created_at: new Date().toISOString(),
            },
            correlationId
          )
        ),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(
        JSON.stringify(createErrorResponse('INVALID_PAYLOAD', 'Invalid JSON body', undefined, correlationId)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('METHOD_NOT_ALLOWED', `Method ${request.method} not allowed`, undefined, correlationId)),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
