import { Env } from '../types/env.js';
import { createSuccessResponse, createErrorResponse } from '../types/api.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import {
  JobListing,
  UserProfile,
  TailoredDocument,
  DocumentType,
  LocaleCode,
  DocumentStatus,
} from '../types/domain.js';
import { TailoredDocumentGenerator } from '../services/documents/tailored_document_generator.js';

const docGenerator = new TailoredDocumentGenerator();

export async function handleTailoredDocuments(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // 1. POST /api/v1/documents/tailored/:id/approve
  const approveMatch = pathname.match(/^\/api\/v1\/documents\/tailored\/([a-zA-Z0-9_-]+)\/approve$/);
  if (method === 'POST' && approveMatch) {
    const docId = approveMatch[1];
    return handleApproveDocument(docId, env, user, correlationId);
  }

  // 2. GET / PUT / DELETE /api/v1/documents/tailored/:id
  const singleDocMatch = pathname.match(/^\/api\/v1\/documents\/tailored\/([a-zA-Z0-9_-]+)$/);
  if (singleDocMatch) {
    const docId = singleDocMatch[1];
    if (method === 'GET') {
      return handleGetDocumentById(docId, env, user, correlationId);
    }
    if (method === 'PUT') {
      return handleUpdateDocument(docId, request, env, user, correlationId);
    }
    if (method === 'DELETE') {
      return handleDeleteDocument(docId, env, user, correlationId);
    }
  }

  // 3. POST /api/v1/documents/tailored (generate new tailored doc)
  if (method === 'POST' && pathname === '/api/v1/documents/tailored') {
    return handleGenerateDocument(request, env, user, correlationId);
  }

  // 4. GET /api/v1/documents/tailored (list all for user)
  if (method === 'GET' && pathname === '/api/v1/documents/tailored') {
    return handleListDocuments(url, env, user, correlationId);
  }

  return new Response(
    JSON.stringify(createErrorResponse('METHOD_NOT_ALLOWED', `Method ${method} not allowed`, undefined, correlationId)),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleGenerateDocument(
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

  const { job_id, document_type, language } = body || {};

  if (!job_id || typeof job_id !== 'string') {
    return new Response(
      JSON.stringify(createErrorResponse('MISSING_FIELD', 'Field job_id is required', undefined, correlationId)),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (document_type !== 'CV' && document_type !== 'COVER_LETTER') {
    return new Response(
      JSON.stringify(createErrorResponse('INVALID_FIELD', 'Field document_type must be CV or COVER_LETTER', undefined, correlationId)),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const validLang: LocaleCode = language === 'fr' || language === 'it' ? language : 'en';

  // 1. Fetch Job from DB
  let job: JobListing | null = null;
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const row = await env.DB.prepare('SELECT * FROM job_listings WHERE id = ?').bind(job_id).first<any>();
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
      console.warn('Failed to query job listing for doc gen:', err.message);
    }
  }

  if (!job) {
    return new Response(
      JSON.stringify(createErrorResponse('NOT_FOUND', `Job listing ${job_id} not found`, undefined, correlationId)),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Fetch User Profile
  let profile: UserProfile | null = null;
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const uRow = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first<any>();
      if (uRow && uRow.profile_data) {
        profile = JSON.parse(uRow.profile_data);
      } else if (uRow) {
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
    } catch (err: any) {
      console.warn('Failed to query user profile for doc gen:', err.message);
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

  // 3. Compute version number
  let nextVersion = 1;
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const vRow = await env.DB.prepare(
        'SELECT MAX(version_number) as max_v FROM tailored_documents WHERE user_id = ? AND job_id = ? AND document_type = ?'
      )
        .bind(user.userId, job_id, document_type)
        .first<any>();

      if (vRow?.max_v) {
        nextVersion = Number(vRow.max_v) + 1;
      }
    } catch (err: any) {
      console.warn('Failed to query max version for tailored doc:', err.message);
    }
  }

  // 4. Generate document
  const tailoredDoc = await docGenerator.generateDocument(
    {
      job,
      profile,
      documentType: document_type as DocumentType,
      language: validLang,
      versionNumber: nextVersion,
    },
    env
  );

  // 5. Persist in D1 tailored_documents
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      await env.DB.prepare(
        `INSERT INTO tailored_documents (
          id, user_id, job_id, document_type, language, version_number,
          title, content_markdown, status, generation_model, generation_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          tailoredDoc.id,
          tailoredDoc.user_id,
          tailoredDoc.job_id,
          tailoredDoc.document_type,
          tailoredDoc.language,
          tailoredDoc.version_number,
          tailoredDoc.title,
          tailoredDoc.content_markdown,
          tailoredDoc.status,
          tailoredDoc.generation_model,
          tailoredDoc.generation_notes || null,
          tailoredDoc.created_at,
          tailoredDoc.updated_at
        )
        .run();
    } catch (err: any) {
      console.warn('Failed to persist tailored document to D1:', err.message);
    }
  }

  return new Response(JSON.stringify(createSuccessResponse(tailoredDoc, correlationId)), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetDocumentById(
  docId: string,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const row = await env.DB.prepare('SELECT * FROM tailored_documents WHERE id = ?')
        .bind(docId)
        .first<any>();

      if (row) {
        // Multi-tenant check: Candidate can only access their own documents
        if (row.user_id !== user.userId) {
          return new Response(
            JSON.stringify(createErrorResponse('FORBIDDEN', 'Access denied to this document', undefined, correlationId)),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify(createSuccessResponse(formatDocRow(row), correlationId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err: any) {
      console.warn('Failed to get tailored document from D1:', err.message);
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('NOT_FOUND', `Document ${docId} not found`, undefined, correlationId)),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateDocument(
  docId: string,
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

  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const existing = await env.DB.prepare('SELECT * FROM tailored_documents WHERE id = ?')
        .bind(docId)
        .first<any>();

      if (!existing) {
        return new Response(
          JSON.stringify(createErrorResponse('NOT_FOUND', `Document ${docId} not found`, undefined, correlationId)),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (existing.user_id !== user.userId) {
        return new Response(
          JSON.stringify(createErrorResponse('FORBIDDEN', 'Access denied to this document', undefined, correlationId)),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const newContent = typeof body?.content_markdown === 'string' ? body.content_markdown : existing.content_markdown;
      const newTitle = typeof body?.title === 'string' ? body.title : existing.title;
      const now = new Date().toISOString();
      const newStatus = existing.status === 'APPROVED' ? 'REVIEWED' : 'REVIEWED'; // Editing an approved draft puts it back to reviewed

      await env.DB.prepare(
        'UPDATE tailored_documents SET content_markdown = ?, title = ?, status = ?, updated_at = ? WHERE id = ?'
      )
        .bind(newContent, newTitle, newStatus, now, docId)
        .run();

      const updatedDoc: TailoredDocument = {
        ...formatDocRow(existing),
        content_markdown: newContent,
        title: newTitle,
        status: newStatus as DocumentStatus,
        updated_at: now,
      };

      return new Response(JSON.stringify(createSuccessResponse(updatedDoc, correlationId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.warn('Failed to update tailored document in D1:', err.message);
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('INTERNAL_SERVER_ERROR', 'Database unavailable', undefined, correlationId)),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleApproveDocument(
  docId: string,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const existing = await env.DB.prepare('SELECT * FROM tailored_documents WHERE id = ?')
        .bind(docId)
        .first<any>();

      if (!existing) {
        return new Response(
          JSON.stringify(createErrorResponse('NOT_FOUND', `Document ${docId} not found`, undefined, correlationId)),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (existing.user_id !== user.userId) {
        return new Response(
          JSON.stringify(createErrorResponse('FORBIDDEN', 'Access denied to this document', undefined, correlationId)),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date().toISOString();
      await env.DB.prepare('UPDATE tailored_documents SET status = ?, updated_at = ? WHERE id = ?')
        .bind('APPROVED', now, docId)
        .run();

      const updatedDoc: TailoredDocument = {
        ...formatDocRow(existing),
        status: 'APPROVED',
        updated_at: now,
      };

      return new Response(JSON.stringify(createSuccessResponse(updatedDoc, correlationId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.warn('Failed to approve tailored document in D1:', err.message);
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('INTERNAL_SERVER_ERROR', 'Database unavailable', undefined, correlationId)),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleDeleteDocument(
  docId: string,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const existing = await env.DB.prepare('SELECT * FROM tailored_documents WHERE id = ?')
        .bind(docId)
        .first<any>();

      if (!existing) {
        return new Response(
          JSON.stringify(createErrorResponse('NOT_FOUND', `Document ${docId} not found`, undefined, correlationId)),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (existing.user_id !== user.userId) {
        return new Response(
          JSON.stringify(createErrorResponse('FORBIDDEN', 'Access denied to this document', undefined, correlationId)),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await env.DB.prepare('DELETE FROM tailored_documents WHERE id = ?').bind(docId).run();

      return new Response(
        JSON.stringify(createSuccessResponse({ success: true, deleted_id: docId }, correlationId)),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      console.warn('Failed to delete tailored document from D1:', err.message);
    }
  }

  return new Response(
    JSON.stringify(createErrorResponse('INTERNAL_SERVER_ERROR', 'Database unavailable', undefined, correlationId)),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleListDocuments(
  url: URL,
  env: Env,
  user: AuthenticatedUser,
  correlationId: string
): Promise<Response> {
  const jobIdParam = url.searchParams.get('job_id');
  const typeParam = url.searchParams.get('document_type');

  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      let query = 'SELECT * FROM tailored_documents WHERE user_id = ?';
      const bindings: any[] = [user.userId];

      if (jobIdParam) {
        query += ' AND job_id = ?';
        bindings.push(jobIdParam);
      }
      if (typeParam) {
        query += ' AND document_type = ?';
        bindings.push(typeParam);
      }

      query += ' ORDER BY version_number DESC, created_at DESC LIMIT 50';

      const result = await env.DB.prepare(query).bind(...bindings).all<any>();
      const items = (result.results || []).map(formatDocRow);

      return new Response(JSON.stringify(createSuccessResponse({ items, total: items.length }, correlationId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.warn('Failed to list tailored documents from D1:', err.message);
    }
  }

  return new Response(JSON.stringify(createSuccessResponse({ items: [], total: 0 }, correlationId)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formatDocRow(row: any): TailoredDocument {
  return {
    id: row.id,
    user_id: row.user_id,
    job_id: row.job_id,
    document_type: row.document_type,
    language: row.language,
    version_number: row.version_number,
    title: row.title,
    content_markdown: row.content_markdown,
    status: row.status,
    generation_model: row.generation_model,
    generation_notes: row.generation_notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}
