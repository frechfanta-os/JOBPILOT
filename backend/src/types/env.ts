export interface Env {
  // Cloudflare D1 Database binding
  DB: D1Database;

  // Cloudflare R2 Bucket binding
  DOCUMENTS_BUCKET: R2Bucket;

  // Cloudflare KV Namespace binding
  CONFIG_KV: KVNamespace;

  // Cloudflare Queue binding (optional/future)
  JOB_INGESTION_QUEUE?: Queue<any>;

  // Non-sensitive environment variables
  ENVIRONMENT: string;
  API_VERSION: string;
  EMERGENCY_STOP_DEFAULT: string;

  // Secrets injected via `wrangler secret put`
  OPENROUTER_API_KEY?: string;
  JWT_SIGNING_SECRET?: string;
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  JOOBLE_API_KEY?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
