import { createErrorResponse } from '../types/api.js';
import { Env } from '../types/env.js';
import { verifyJwt } from '../utils/jwt.js';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

const DEFAULT_DEV_JWT_SECRET = 'jobpilot-dev-jwt-hmac-sha256-secret-not-for-production';

/**
 * Authentication Middleware with Cryptographic JWT Verification.
 * All /api/v1 endpoints (except health checks) are protected by default.
 * Validates HMAC-SHA256 signature and expiration using Web Crypto API.
 */
export async function authenticateRequest(
  request: Request,
  env: Env,
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
            'Authentication token is empty or malformed.',
            undefined,
            correlationId
          )
        ),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  // Determine JWT secret
  let secret = env.JWT_SIGNING_SECRET;
  if (!secret) {
    if (env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development' || !env.ENVIRONMENT) {
      secret = DEFAULT_DEV_JWT_SECRET;
    } else {
      return {
        errorResponse: new Response(
          JSON.stringify(
            createErrorResponse(
              'INTERNAL_CONFIGURATION_ERROR',
              'Authentication service misconfigured: JWT_SIGNING_SECRET is missing.',
              undefined,
              correlationId
            )
          ),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
  }

  // Cryptographic JWT signature and expiration verification
  const verification = await verifyJwt(token, secret);
  if (!verification.valid || !verification.payload) {
    return {
      errorResponse: new Response(
        JSON.stringify(
          createErrorResponse(
            'UNAUTHORIZED',
            verification.error || 'Invalid or expired authentication token.',
            undefined,
            correlationId
          )
        ),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return {
    user: {
      userId: verification.payload.sub,
      email: verification.payload.email,
    },
  };
}
