import { createErrorResponse } from '../types/api.js';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

/**
 * Authentication Middleware.
 * All /api/v1 endpoints (except health checks) are protected by default.
 * In Phase 2, validates Bearer tokens. In subsequent phases, full JWT verification
 * against JWT_SIGNING_SECRET is plugged in once provider decision is approved.
 */
export async function authenticateRequest(
  request: Request,
  correlationId: string
): Promise<{ user?: AuthenticatedUser; errorResponse?: Response }> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      errorResponse: new Response(
        JSON.stringify(
          createErrorResponse(
            'UNAUTHORIZED',
            'Authentication token is required to access this resource. Provide Authorization: Bearer <token>.',
            undefined,
            correlationId
          )
        ),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      errorResponse: new Response(
        JSON.stringify(
          createErrorResponse(
            'INVALID_TOKEN',
            'Authentication token is malformed.',
            undefined,
            correlationId
          )
        ),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  // Placeholder / Developer Token decoding for local development
  // Full cryptographic JWT signature verification is activated in Milestone 1/4 with JWT_SIGNING_SECRET
  return {
    user: {
      userId: token.startsWith('usr_') ? token : 'usr_default_candidate',
    },
  };
}
