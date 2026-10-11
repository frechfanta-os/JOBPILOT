# JobPilot International

> **Personal Android Job-Search & Application-Management Assistant**  
> **Initial Target Markets**: Canada 🇨🇦 & Italy 🇮🇹  
> **Application Package ID**: `com.ghdinteractivestudio.jobpilot`  
> **Official Repository**: `https://github.com/frechfanta-os/JOBPILOT`  
> **Architecture**: Flutter Android Client + Cloudflare Workers / D1 / R2 Serverless Backend  
> **Methodology**: Replica Skills Framework (`recon`, `architect`, `design`, `build`, `backend`, `test`, `diff`)

---

## 1. Overview

JobPilot International is an intelligent, privacy-first mobile assistant engineered to streamline the full lifecycle of cross-border and domestic job applications for Canada and Italy. Rather than functioning as a passive job board aggregator, JobPilot operates as an active personal assistant:

```
Personal Profile & CV ➔ Job Discovery ➔ Eligibility Assessment ➔ Match Scoring ➔ Tailored CV & Cover Letter ➔ Authorized Submission ➔ Email Monitoring ➔ Follow-up Tracking
```

### Core Tenets
- **Factual Integrity**: Never hallucinates credentials, work history, or qualifications.
- **Privacy & Ownership**: Personal single-user architecture with server-side authorization and encrypted tokens.
- **Human-in-the-Loop**: All consequential actions (submitting applications, dispatching emails) require explicit user approval.
- **Clean-Room Engineering**: 100% original code and design tokens built using official, authorized APIs only.

---

## 2. Monorepo Structure

```
JOBPILOT/
├── app/                  # Android mobile application (Flutter / Dart)
│   ├── android/          # Android platform files & manifest
│   ├── lib/              # Feature-first Flutter codebase
│   └── test/             # Unit and widget tests
│
├── backend/              # Cloudflare Workers API Gateway (TypeScript)
│   ├── src/              # Worker endpoints, controllers & services
│   ├── migrations/       # D1 SQLite schema migrations
│   ├── test/             # Backend contract and unit tests
│   └── wrangler.toml     # Cloudflare Worker configuration & bindings
│
├── docs/                 # Architectural specifications & Phase reports
├── .github/workflows/    # CI/CD pipelines (Format, Tests, Release APK build)
├── MODULE_CONTRACTS.md   # Shared contracts, D1 schemas & API endpoints
├── IMPLEMENTATION_PLAN.md# Milestone roadmap & acceptance criteria
├── INITIAL_THREAT_MODEL.md # OWASP threat matrix & security safeguards
├── PARALLEL_DEVELOPMENT_PLAN.md # Workstreams A-I & file ownership
└── SETUP_CREDENTIALS_REPORT.md  # Provider access status (zero secrets)
```

---

## 3. Technology Stack

### Mobile Application (`app/`)
- **Framework**: Flutter `3.47.5` (Channel stable) / Dart `3.13.4`
- **Application ID**: `com.ghdinteractivestudio.jobpilot`
- **State Management**: Flutter Riverpod
- **Routing**: GoRouter
- **Design System**: Material 3 (adaptive Light & Dark themes, WCAG AA compliant)
- **Local Persistence**: SQLite / Hive for offline resilience

### Backend Services (`backend/`)
- **Runtime**: Cloudflare Workers (TypeScript / ES Modules)
- **Database**: Cloudflare D1 (Serverless SQLite)
- **Object Storage**: Cloudflare R2 (Encrypted storage for CVs and generated PDFs)
- **Cache & Rate Limiting**: Cloudflare KV
- **Task Queues**: Cloudflare Queues (asynchronous job ingestion)
- **AI Engine**: OpenRouter (Configurable LLM provider with grounding prompts)

---

## 4. Local Development & Verification

### Prerequisites
- Node.js `v22.x` & npm `9.x+`
- Flutter `3.47.5+` & Dart `3.13.4+`
- OpenJDK 17 (`JAVA_HOME` configured)

### Backend Local Testing
```bash
cd backend
npm install
npm test
```

### Flutter Local Testing & Analysis
```bash
cd app
flutter pub get
flutter analyze
flutter test
```

### CI / CD Pipeline
Automated through GitHub Actions (`.github/workflows/ci.yml`):
- Dart code formatting & static analysis.
- Flutter unit and widget tests.
- Backend TypeScript compilation, linting, and schema migration validation.
- Release APK build following the mandatory OTA specification with SHA-256 checksums.

---

## 5. Governance and Specifications
- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [Module Contracts & Schemas](MODULE_CONTRACTS.md)
- [Initial Threat Model](INITIAL_THREAT_MODEL.md)
- [Parallel Development Plan](PARALLEL_DEVELOPMENT_PLAN.md)
- [Setup & Credentials Report](SETUP_CREDENTIALS_REPORT.md)
