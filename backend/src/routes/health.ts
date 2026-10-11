import { Env } from '../types/env.js';
import { createSuccessResponse } from '../types/api.js';

export async function handleHealthCheck(request: Request, env: Env, correlationId: string): Promise<Response> {
  const healthData = {
    status: 'healthy',
    version: env.API_VERSION || 'v1',
    environment: env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    supported_countries: ['CA', 'IT'],
    readiness: {
      d1_database: env.DB ? 'READY' : 'NOT_CONFIGURED',
      r2_storage: env.DOCUMENTS_BUCKET ? 'READY' : 'NOT_CONFIGURED',
      kv_cache: env.CONFIG_KV ? 'READY' : 'NOT_CONFIGURED',
      ai_openrouter: env.OPENROUTER_API_KEY ? 'READY' : 'NOT_CONFIGURED',
    },
  };

  return new Response(JSON.stringify(createSuccessResponse(healthData, correlationId)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
