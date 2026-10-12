import { Env } from '../types/env.js';
import { createSuccessResponse, createErrorResponse } from '../types/api.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { JobListing, UserProfile, MatchAssessment } from '../types/domain.js';
import { MatchingEngine } from '../services/matching/matching_engine.js';

const matchingEngine = new MatchingEngine();

export async function handleMatches(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // 1. POST /api/v1/matches/assess
  if (method === 'POST' && pathname === '/api/v1/matches/assess') {
    return handleAssessMatch(request, env, user, correlationId);
  }

  // 2. GET /api/v1/matches/by-job/:jobId
  const byJobMatch = pathname.match(/^\/api\/v1\/matches\/by-job\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && byJobMatch) {
    const jobId = byJobMatch[1];
    return handleGetMatchByJob(jobId, env, user, correlationId);
  }

  // 3. GET /api/v1/matches/:id
  const singleMatch = pathname.match(/^\/api\/v1\/matches\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && singleMatch && singleMatch[1] !== 'assess') {
    const matchId = singleMatch[1];
    return handleGetMatchById(matchId, env, user, correlationId);
  }

  // 4. GET /api/v1/matches (list all for user)
  if (method === 'GET' && pathname === '/api/v1/matches') {
    return handleListMatches(url, env, user, correlationId);
  }

  return new Response(
    JSON.stringify(createErrorResponse('METHOD_NOT_ALLOWED', `Method ${method} not allowed`, undefined, correlationId)),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleAssessMatch(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify(createErrorResponse('INVALID_REQUEST', 'Request body must be valid JSON', undefined, correlationId)),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const jobId = body?.job_id;
  if (!jobId || typeof jobId !== 'string') {
    return new Response(
      JSON.stringify(createErrorResponse('MISSING_FIELD', 'Field job_id is required', undefined, correlationId)),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 1. Fetch Job from DB
  let job: JobListing | null = null;
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const row = await env.DB.prepare('SELECT * FROM job_listings WHERE id = ?').bind(jobId).first<any>();
      if (row) {
        job = {
          id: row.id,
          source_id: row.source_id,
          source_provider: row.source_provider,
          source_attribution: row.source_attribution || row.source_provider,
          title: row.title,
          company_name: row.company_name,
          country: row.country,
          city: row.city,
          province_or_region: row.province_or_region,
          is_remote: row.is_remote === 1,
          contract_type: row.contract_type,
          salary_min: row.salary_min,
          salary_max: row.salary_max,
          currency: row.currency,
          description_raw: row.description_raw,
          description_summary: row.description_summary,
          required_languages: typeof row.required_languages === 'string' ? JSON.parse(row.required_languages) : row.required_languages || [],
          required_skills: typeof row.required_skills === 'string' ? JSON.parse(row.required_skills) : row.required_skills || [],
          source_url: row.source_url,
          application_url: row.application_url,
          content_hash: row.content_hash,
          status: row.status,
          published_at: row.published_at,
          retrieved_at: row.retrieved_at,
        };
      }
    } catch (err: any) {
      console.warn('Failed to query job listing from D1:', err.message);
    }
  }

  if (!job) {
    return new Response(
      JSON.stringify(createErrorResponse('NOT_FOUND', `Job listing ${jobId} not found`, undefined, correlationId)),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Fetch User Profile
  let profile: UserProfile | null = null;
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const uRow = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first<any>();
      if (uRow) {
        if (uRow.profile_data) {
          profile = JSON.parse(uRow.profile_data);
        } else {
          profile = {
            id: uRow.id,
            email: uRow.email,
            first_name: uRow.first_name,
            last_name: uRow.last_name,
            target_countries: JSON.parse(uRow.target_countries || '["CA", "IT"]'),
            primary_language: uRow.primary_language || 'en',
            skills: [],
            experiences: [],
            education: [],
            languages: [{ code: uRow.primary_language || 'en', proficiency: 'PROFESSIONAL' }],
            created_at: uRow.created_at,
            updated_at: uRow.updated_at,
          };
        }
      }
    } catch (err: any) {
      console.warn('Failed to query user profile from D1:', err.message);
    }
  }

  if (!profile) {
    profile = {
      id: user.userId,
      email: user.email || 'user@example.com',
      first_name: 'Candidate',
      last_name: '',
      target_countries: ['CA', 'IT'],
      primary_language: 'en',
      skills: [],
      experiences: [],
      education: [],
      languages: [{ code: 'en', proficiency: 'PROFESSIONAL' }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // 3. Assess Match
  const assessment = await matchingEngine.assessMatch(job, profile, env, {
    customWeights: body?.options?.customWeights,
    skipAiEnrichment: body?.options?.skipAiEnrichment,
  });

  // 4. Upsert into D1 match_assessments
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      await env.DB.prepare(
        `INSERT INTO match_assessments (
          id, user_id, job_id, overall_score, skills_score, experience_score,
          education_score, language_score, location_score, criteria_weights,
          authorization_compatibility, matched_skills, missing_skills,
          matching_evidence, risk_factors, unverified_requirements,
          recommended_actions, assessment_model, scoring_version,
          profile_updated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, job_id) DO UPDATE SET
          overall_score = excluded.overall_score,
          skills_score = excluded.skills_score,
          experience_score = excluded.experience_score,
          education_score = excluded.education_score,
          language_score = excluded.language_score,
          location_score = excluded.location_score,
          criteria_weights = excluded.criteria_weights,
          authorization_compatibility = excluded.authorization_compatibility,
          matched_skills = excluded.matched_skills,
          missing_skills = excluded.missing_skills,
          matching_evidence = excluded.matching_evidence,
          risk_factors = excluded.risk_factors,
          unverified_requirements = excluded.unverified_requirements,
          recommended_actions = excluded.recommended_actions,
          assessment_model = excluded.assessment_model,
          scoring_version = excluded.scoring_version,
          profile_updated_at = excluded.profile_updated_at,
          updated_at = excluded.updated_at`
      )
        .bind(
          assessment.id,
          assessment.user_id,
          assessment.job_id,
          assessment.overall_score,
          assessment.skills_score,
          assessment.experience_score,
          assessment.education_score,
          assessment.language_score,
          assessment.location_score,
          JSON.stringify(assessment.criteria_weights),
          assessment.authorization_compatibility,
          JSON.stringify(assessment.matched_skills),
          JSON.stringify(assessment.missing_skills),
          JSON.stringify(assessment.matching_evidence),
          JSON.stringify(assessment.risk_factors),
          JSON.stringify(assessment.unverified_requirements),
          JSON.stringify(assessment.recommended_actions),
          assessment.assessment_model,
          assessment.scoring_version,
          assessment.profile_updated_at || null,
          assessment.created_at,
          assessment.updated_at
        )
        .run();
    } catch (err: any) {
      console.warn('Failed to persist match assessment to D1:', err.message);
    }
  }

  return new Response(JSON.stringify(createSuccessResponse(assessment, correlationId)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetMatchByJob(
  jobId: string,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const row = await env.DB.prepare(
        'SELECT * FROM match_assessments WHERE user_id = ? AND job_id = ?'
      )
        .bind(user.userId, jobId)
        .first<any>();

      if (row) {
        return new Response(JSON.stringify(createSuccessResponse(formatMatchRow(row), correlationId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err: any) {
      console.warn('Failed to query match by job from D1:', err.message);
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('NOT_FOUND', `No assessment found for job ${jobId}`, undefined, correlationId)),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleGetMatchById(
  matchId: string,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const row = await env.DB.prepare('SELECT * FROM match_assessments WHERE id = ?')
        .bind(matchId)
        .first<any>();

      if (row) {
        // Multi-tenant check: User cannot view another candidate's match assessment
        if (row.user_id !== user.userId) {
          return new Response(
            JSON.stringify(createErrorResponse('FORBIDDEN', 'Access denied to this assessment', undefined, correlationId)),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify(createSuccessResponse(formatMatchRow(row), correlationId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err: any) {
      console.warn('Failed to query match by id from D1:', err.message);
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('NOT_FOUND', `Assessment ${matchId} not found`, undefined, correlationId)),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleListMatches(
  url: URL,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  const jobIdParam = url.searchParams.get('job_id');

  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      let query = 'SELECT * FROM match_assessments WHERE user_id = ?';
      const bindings: any[] = [user.userId];

      if (jobIdParam) {
        query += ' AND job_id = ?';
        bindings.push(jobIdParam);
      }

      query += ' ORDER BY created_at DESC LIMIT 50';

      const result = await env.DB.prepare(query).bind(...bindings).all<any>();
      const items = (result.results || []).map(formatMatchRow);

      return new Response(JSON.stringify(createSuccessResponse({ items, total: items.length }, correlationId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.warn('Failed to list match assessments from D1:', err.message);
    }
  }

  return new Response(JSON.stringify(createSuccessResponse({ items: [], total: 0 }, correlationId)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formatMatchRow(row: any): MatchAssessment {
  return {
    id: row.id,
    user_id: row.user_id,
    job_id: row.job_id,
    overall_score: row.overall_score,
    skills_score: row.skills_score,
    experience_score: row.experience_score,
    education_score: row.education_score || 0,
    language_score: row.language_score,
    location_score: row.location_score || 0,
    criteria_weights: typeof row.criteria_weights === 'string' ? JSON.parse(row.criteria_weights) : row.criteria_weights || {},
    authorization_compatibility: row.authorization_compatibility,
    matched_skills: typeof row.matched_skills === 'string' ? JSON.parse(row.matched_skills) : row.matched_skills || [],
    missing_skills: typeof row.missing_skills === 'string' ? JSON.parse(row.missing_skills) : row.missing_skills || [],
    matching_evidence: typeof row.matching_evidence === 'string' ? JSON.parse(row.matching_evidence) : row.matching_evidence || [],
    risk_factors: typeof row.risk_factors === 'string' ? JSON.parse(row.risk_factors) : row.risk_factors || [],
    unverified_requirements: typeof row.unverified_requirements === 'string' ? JSON.parse(row.unverified_requirements) : row.unverified_requirements || [],
    recommended_actions: typeof row.recommended_actions === 'string' ? JSON.parse(row.recommended_actions) : row.recommended_actions || [],
    assessment_model: row.assessment_model,
    scoring_version: row.scoring_version || 'v1.0-deterministic',
    profile_updated_at: row.profile_updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}
