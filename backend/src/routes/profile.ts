import { Env } from '../types/env.js';
import { createSuccessResponse, createErrorResponse } from '../types/api.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { UserProfile } from '../types/domain.js';

export async function handleProfile(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (request.method === 'GET') {
    // Attempt to retrieve profile from D1 if database is available
    if (env.DB && typeof env.DB.prepare === 'function') {
      try {
        const result = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first<any>();
        if (result) {
          let fullProfile: Partial<UserProfile> = {};
          if (result.profile_data) {
            try {
              fullProfile = JSON.parse(result.profile_data);
            } catch (_) {}
          }

          const targetCountries = typeof result.target_countries === 'string'
            ? JSON.parse(result.target_countries)
            : result.target_countries || ['CA', 'IT'];

          return new Response(
            JSON.stringify(
              createSuccessResponse(
                {
                  id: result.id,
                  email: result.email,
                  first_name: result.first_name || fullProfile.first_name || '',
                  last_name: result.last_name || fullProfile.last_name || '',
                  phone_number: fullProfile.phone_number || '',
                  location: fullProfile.location || '',
                  headline: fullProfile.headline || '',
                  summary: fullProfile.summary || '',
                  target_countries: targetCountries,
                  primary_language: result.primary_language || fullProfile.primary_language || 'en',
                  work_authorization: fullProfile.work_authorization || {
                    canada_status: 'UNKNOWN',
                    italy_status: 'UNKNOWN',
                    verified_by_user: false,
                  },
                  skills: fullProfile.skills || [],
                  experiences: fullProfile.experiences || [],
                  education: fullProfile.education || [],
                  languages: fullProfile.languages || [],
                  is_confirmed_by_user: fullProfile.is_confirmed_by_user ?? true,
                  created_at: result.created_at,
                  updated_at: result.updated_at,
                },
                correlationId
              )
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (err: any) {
        console.warn('D1 profile fetch error:', err.message);
      }
    }

    // Default structured profile template
    const defaultProfile: UserProfile = {
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
      is_confirmed_by_user: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(createSuccessResponse(defaultProfile, correlationId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json() as any;
      const now = new Date().toISOString();
      const profileDataJson = JSON.stringify(body);

      // Upsert into D1 users table if available
      if (env.DB && typeof env.DB.prepare === 'function') {
        try {
          await env.DB.prepare(
            `INSERT INTO users (id, email, first_name, last_name, target_countries, primary_language, profile_data, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               email = excluded.email,
               first_name = excluded.first_name,
               last_name = excluded.last_name,
               target_countries = excluded.target_countries,
               primary_language = excluded.primary_language,
               profile_data = excluded.profile_data,
               updated_at = excluded.updated_at`
          ).bind(
            user.userId,
            body.email || user.email || 'candidate@jobpilot.app',
            body.first_name || '',
            body.last_name || '',
            JSON.stringify(body.target_countries || ['CA', 'IT']),
            body.primary_language || 'en',
            profileDataJson,
            now
          ).run();
        } catch (dbErr: any) {
          // If profile_data column doesn't exist yet, fall back to basic update
          try {
            await env.DB.prepare(
              `INSERT INTO users (id, email, first_name, last_name, target_countries, primary_language, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 email = excluded.email,
                 first_name = excluded.first_name,
                 last_name = excluded.last_name,
                 target_countries = excluded.target_countries,
                 primary_language = excluded.primary_language,
                 updated_at = excluded.updated_at`
            ).bind(
              user.userId,
              body.email || user.email || 'candidate@jobpilot.app',
              body.first_name || '',
              body.last_name || '',
              JSON.stringify(body.target_countries || ['CA', 'IT']),
              body.primary_language || 'en',
              now
            ).run();
          } catch (fallbackErr: any) {
            console.warn('D1 profile fallback error:', fallbackErr.message);
          }
        }
      }

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
