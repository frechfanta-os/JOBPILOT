# JOBPILOT INTERNATIONAL — SETUP & CREDENTIALS REPORT

> **Security Level**: Confidential Configuration Audit  
> **Rule Compliance**: Zero Secret Values Exposed. Only sanitized fingerprints and verified statuses are recorded.  
> **Author / Role**: Application Security Engineer & DevOps Architect  
> **Target Project**: JobPilot International  
> **Timestamp**: 2026-10-11T14:32:00Z  

---

## 1. Overview and Credential Governance

This document establishes the security perimeter, credential audit, and access configuration for JobPilot International across all external providers and platforms.

In accordance with strict security policies:
1. **Never commit secrets**: No API tokens, private keys, client secrets, or credentials may be stored in Git or public repositories.
2. **Environment variable isolation**: Server-side secrets must reside in Cloudflare Worker secrets or `.dev.vars` (strictly in `.gitignore`). Client-side Flutter code must contain only public endpoints and client identifiers.
3. **Least privilege principle**: All service integrations must request the minimum necessary scopes (e.g., read-only access for Gmail and external feeds).

---

## 2. Comprehensive Provider Audit & Verification Status

| Provider / Service | Verified Access Status | Scope / Role Tested | Reusable Resources Identified | Missing Configuration / Blockers | Safe Next Steps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GitHub (`frechfanta-os`)** | **VERIFIED ACTIVE** | `repo`, `workflow`, `gist`, `read:org` | Remote repo `frechfanta-os/JOBPILOT`, CI/CD workflow runner capacity | None. CLI authentication fully operational. | Initialize local project repository and configure GitHub Actions secrets. |
| **OpenRouter AI** | **VERIFIED ACTIVE** | API Key authenticated (Limit: 50, Usage: 0) | Access to LLM models (Claude 3.5 Sonnet, GPT-4o-mini, Mistral, Llama 3) | Backend worker binding variable `OPENROUTER_API_KEY` to be set in Cloudflare secrets. | Add secret to Cloudflare Worker via `wrangler secret put OPENROUTER_API_KEY`. |
| **Cloudflare R2 (S3 API)** | **CONFIGURED IN MEMORY** | S3 API endpoint & Access Key ID registered | Account ID `7b2260ba6e6ea12f6271c9e8e78bc391`, R2 storage subsystem | Bucket creation (`jobpilot-documents`) and direct Worker R2 binding. | Create bucket via Wrangler in Phase 2 and bind directly to Worker (`env.DOCUMENTS_BUCKET`). |
| **Cloudflare Workers / D1** | **NOT CONFIGURED** | Workers API Token not active in CLI session | Cloudflare account `7b2260ba6e6ea12f6271c9e8e78bc391` | Wrangler CLI authentication not yet initialized; D1 database not created. | Execute `npx wrangler login` or set `CLOUDFLARE_API_TOKEN` with Workers & D1 Edit permissions. |
| **Google Cloud / Gmail** | **NOT CONFIGURED** | N/A | None | GCP project, OAuth 2.0 Client ID, Client Secret, and consent screen not created. | Create GCP project in Google Cloud Console, configure OAuth consent screen with `gmail.readonly` scope. |
| **Job Source: Job Bank CA** | **PUBLIC ACCESS** | Open Data / Public Feeds | Public RSS & JSON endpoints from `jobbank.gc.ca` | API developer registration optional for higher rate limits. | Implement public feed parser with rate limiting and caching. |
| **Job Source: Adzuna (CA/IT)** | **NOT CONFIGURED** | Developer API | Developer portal available (`developer.adzuna.com`) | `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` not yet registered. | Register free developer account to obtain application credentials for Canada and Italy. |
| **Stitch MCP UI Tool** | **VERIFIED ACTIVE** | `STITCH_API_KEY` present in host environment | Stitch MCP server tools available in Antigravity | None. Available for UI screen generation and design system tokens. | Utilize Stitch MCP for Flutter screen wireframing and design token alignment. |

---

## 3. Secret Management & Storage Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SECRET DISTRIBUTION MODEL                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. FLUTTER CLIENT APP (Android APK)                                    │
│    - Contains ZERO private API keys.                                   │
│    - Contains only: Backend API URL (https://api.jobpilot.app),        │
│      Google OAuth Client ID (public identifier), Public App Config.    │
├────────────────────────────────────────────────────────────────────────┤
│ 2. CLOUDFLARE WORKERS (Server-side API Gateway)                        │
│    - Stores: OPENROUTER_API_KEY (Worker secret)                        │
│    - Stores: ADZUNA_APP_KEY / JOOBLE_KEY (Worker secret)               │
│    - Stores: GOOGLE_CLIENT_SECRET (Worker secret)                      │
│    - Stores: JWT_SIGNING_SECRET (Worker secret)                        │
│    - Bound natively to: D1 (DB), R2 (Storage), KV (Sessions)           │
├────────────────────────────────────────────────────────────────────────┤
│ 3. GITHUB ACTIONS (CI/CD Pipeline)                                     │
│    - Repository Secrets:                                               │
│      * GH_TOKEN / GITHUB_TOKEN (automatic)                             │
│      * ANDROID_KEYSTORE_BASE64 (for release APK signing)               │
│      * ANDROID_KEY_PASSWORD / KEYSTORE_PASSWORD                        │
│      * CLOUDFLARE_API_TOKEN (for automated backend deployment)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. OAuth Scope Analysis: Google / Gmail Integration

For Milestone 5, JobPilot will integrate with Gmail solely to monitor job applications, incoming interview requests, and recruiter responses.

### 4.1 Permitted Scopes
- **Primary Scope**: `https://www.googleapis.com/auth/gmail.readonly`
  - *Justification*: Sufficient to list threads, read message bodies, and inspect headers (`From`, `Subject`, `Date`) to associate emails with job applications.
- **Strictly Prohibited at Inception**:
  - `https://mail.google.com/` (Full access prohibited).
  - `https://www.googleapis.com/auth/gmail.modify` (Unnecessary; user emails will not be deleted or modified).
- **Future Interactive Scope (User-Confirmed Drafts Only)**:
  - `https://www.googleapis.com/auth/gmail.compose` (Allows creating draft replies without sending them automatically).

### 4.2 Credential Handling
- Refresh tokens and access tokens received via OAuth PKCE flow must be encrypted at rest in Cloudflare D1 using an AES-GCM encryption key derived from the backend master key.
- Tokens must never be exported to client application logs or included in HTTP query parameters.

---

## 5. Prerequisites for Phase 2 Implementation

Before initiating backend and integration development in Phase 2, the following actions will be required:
1. **Cloudflare CLI Authorization**:
   - Provide an account-scoped Cloudflare API Token with permissions: `Workers:Edit`, `D1:Edit`, `R2:Edit`, `KV:Edit`.
   - Alternatively, perform interactive `npx wrangler login`.
2. **Adzuna Developer Portal Keys**:
   - Register at `developer.adzuna.com` for CA and IT queries to acquire an App ID and App Key.
3. **Google Cloud Console Registration**:
   - Create project `JobPilot-Assistant`.
   - Configure OAuth 2.0 Client credentials (Android package `com.ghdinteractivestudio.jobpilot` and Web Client ID for Worker token exchange).

---

*Setup & Credentials Report recorded without secret leakage.*
