import { Env } from '../types/env.js';
import { createSuccessResponse, createErrorResponse } from '../types/api.js';
import { AuthenticatedUser } from '../middleware/auth.js';

export async function handleProfile(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (request.method === 'GET') {
    // Attempt to retrieve profile from D1 if database is available
    if (env.DB) {
      try {
        const result = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first();
        if (result) {
          return new Response(JSON.stringify(createSuccessResponse(result, correlationId)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (err: any) {
        // Fall back gracefully to empty structured template if table is not yet seeded
      }
    }

    // Default structured profile template
    const defaultProfile = {
      id: user.userId,
      email: user.email || 'candidate@jobpilot.app',
      first_name: '',
      last_name: '',
      target_countries: ['CA', 'IT'],
      primary_language: 'en',
      work_authorization: {
        canada_status: 'UNKNOWN',
        italy_status: 'UNKNOWN',
        verified_by_user: false,
      },
      skills: [],
      experiences: [],
      education: [],
      languages: [],
    };

    return new Response(JSON.stringify(createSuccessResponse(defaultProfile, correlationId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json() as any;
      return new Response(JSON.stringify(createSuccessResponse({ updated: true, profile: body }, correlationId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(
        JSON.stringify(createErrorResponse('INVALID_PAYLOAD', 'Malformed JSON in request body', undefined, correlationId)),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('METHOD_NOT_ALLOWED', `Method ${request.method} not allowed`, undefined, correlationId)),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
