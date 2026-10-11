import { Env } from './types/env.js';
import { handleCors, applyCorsHeaders } from './middleware/cors.js';
import { authenticateRequest } from './middleware/auth.js';
import { handleHealthCheck } from './routes/health.js';
import { handleProfile } from './routes/profile.js';
import { handleJobs } from './routes/jobs.js';
import { handleApplications } from './routes/applications.js';
import { createErrorResponse } from './types/api.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const correlationId = request.headers.get('X-Correlation-ID') || `corr-${crypto.randomUUID()}`;

    // 1. Handle CORS Preflight
    const corsPreflight = handleCors(request);
    if (corsPreflight) {
      return corsPreflight;
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // 2. Public Endpoints (Health & Status)
      if (pathname === '/api/v1/health' || pathname === '/health') {
        const response = await handleHealthCheck(request, env, correlationId);
        return applyCorsHeaders(response);
      }

      // 3. Authenticated Routes Boundary
      if (pathname.startsWith('/api/v1/')) {
        const auth = await authenticateRequest(request, correlationId);
        if (auth.errorResponse) {
          return applyCorsHeaders(auth.errorResponse);
        }

        const user = auth.user!;

        // Route: /api/v1/profile
        if (pathname === '/api/v1/profile') {
          const response = await handleProfile(request, env, user, correlationId);
          return applyCorsHeaders(response);
        }

        // Route: /api/v1/jobs or /api/v1/jobs/search
        if (pathname === '/api/v1/jobs' || pathname === '/api/v1/jobs/search') {
          const response = await handleJobs(request, env, user, correlationId);
          return applyCorsHeaders(response);
        }

        // Route: /api/v1/applications
        if (pathname === '/api/v1/applications' || pathname.startsWith('/api/v1/applications/')) {
          const response = await handleApplications(request, env, user, correlationId);
          return applyCorsHeaders(response);
        }

        // Unrecognized /api/v1 Route
        return applyCorsHeaders(
          new Response(
            JSON.stringify(createErrorResponse('NOT_FOUND', `Route ${pathname} not found`, undefined, correlationId)),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      // Root Fallback
      return applyCorsHeaders(
        new Response(
          JSON.stringify({
            service: 'JobPilot International API',
            version: env.API_VERSION || 'v1',
            documentation: '/docs',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    } catch (err: any) {
      return applyCorsHeaders(
        new Response(
          JSON.stringify(
            createErrorResponse(
              'INTERNAL_SERVER_ERROR',
              err?.message || 'An unexpected server error occurred',
              undefined,
              correlationId
            )
          ),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }
  },
};
