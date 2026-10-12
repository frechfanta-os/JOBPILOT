import { Env } from '../../types/env.js';
import {
  JobListing,
  UserProfile,
  MatchAssessment,
  CriteriaWeights,
  MatchingEvidence,
  AuthorizationCompatibility,
} from '../../types/domain.js';
import { OpenRouterClient } from '../ai/openrouter_client.js';

export interface MatchingEngineOptions {
  customWeights?: Partial<CriteriaWeights>;
  skipAiEnrichment?: boolean;
}

export class MatchingEngine {
  public static readonly DEFAULT_WEIGHTS: CriteriaWeights = {
    skills: 0.40,
    experience: 0.25,
    education: 0.15,
    language: 0.10,
    location: 0.10,
  };

  public static readonly SCORING_VERSION = 'v1.0-deterministic-ai-enriched';

  private openRouterClient = new OpenRouterClient();

  /**
   * Evaluates job listing compatibility against confirmed candidate profile.
   */
  async assessMatch(
    job: JobListing,
    profile: UserProfile,
    env: Env,
    options?: MatchingEngineOptions
  ): Promise<MatchAssessment> {
    const weights: CriteriaWeights = {
      ...MatchingEngine.DEFAULT_WEIGHTS,
      ...(options?.customWeights || {}),
    };

    // 1. Skills Compatibility (40%)
    const skillsAnalysis = this.evaluateSkills(job, profile);

    // 2. Experience Compatibility (25%)
    const experienceAnalysis = this.evaluateExperience(job, profile);

    // 3. Education Compatibility (15%)
    const educationAnalysis = this.evaluateEducation(job, profile);

    // 4. Language Compatibility (10%)
    const languageAnalysis = this.evaluateLanguages(job, profile);

    // 5. Location & Remote Compatibility (10%)
    const locationAnalysis = this.evaluateLocation(job, profile);

    // 6. Work Authorization Assessment
    const authAnalysis = this.evaluateAuthorization(job, profile);

    // Calculate deterministic overall score (0 - 100)
    const rawScore =
      skillsAnalysis.score * weights.skills +
      experienceAnalysis.score * weights.experience +
      educationAnalysis.score * weights.education +
      languageAnalysis.score * weights.language +
      locationAnalysis.score * weights.location;

    const overallScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    // Deterministic evidence, risks, and recommendations
    const matchingEvidence: MatchingEvidence[] = [...skillsAnalysis.evidence, ...experienceAnalysis.evidence];
    const riskFactors: string[] = [];
    const unverifiedRequirements: string[] = [
      ...authAnalysis.unverified,
      ...educationAnalysis.unverified,
      ...languageAnalysis.unverified,
    ];
    const recommendedActions: string[] = [];

    // Synthesize risks
    if (skillsAnalysis.missingSkills.length > 0) {
      riskFactors.push(`Missing ${skillsAnalysis.missingSkills.length} required skill(s): ${skillsAnalysis.missingSkills.slice(0, 3).join(', ')}`);
    }
    if (authAnalysis.compatibility === 'NEEDS_SPONSORSHIP') {
      riskFactors.push(`Candidate requires employer sponsorship for ${job.country === 'CA' ? 'Canada' : 'Italy'}`);
    }
    if (languageAnalysis.score < 70) {
      riskFactors.push(`Language proficiency may not fully satisfy job requirements (${job.required_languages.join(', ') || 'unspecified'})`);
    }

    // Synthesize recommended actions
    if (skillsAnalysis.missingSkills.length > 0) {
      recommendedActions.push(`Emphasize transferable experience relating to: ${skillsAnalysis.missingSkills.slice(0, 2).join(', ')}`);
    }
    if (authAnalysis.compatibility === 'UNVERIFIED_OR_UNKNOWN') {
      recommendedActions.push(`Confirm work authorization status for ${job.country === 'CA' ? 'Canada' : 'Italy'} in your profile`);
    }
    if (job.is_remote) {
      recommendedActions.push('Highlight proven remote collaboration and asynchronous delivery in tailored documents');
    }
    recommendedActions.push(`Tailor CV summary to focus directly on key priorities for ${job.title} at ${job.company_name}`);

    let assessmentModel = 'deterministic-rules-v1';

    // 7. Qualitative AI Enrichment via OpenRouter if configured
    if (!options?.skipAiEnrichment && OpenRouterClient.isConfigured(env)) {
      try {
        const aiAnalysis = await this.openRouterClient.generateMatchAnalysis(job, profile, env);
        if (aiAnalysis) {
          assessmentModel = 'openai/gpt-4o-mini+deterministic-v1';
          if (aiAnalysis.qualifications_evidence?.length) {
            matchingEvidence.push(...aiAnalysis.qualifications_evidence);
          }
          if (aiAnalysis.recommended_actions?.length) {
            recommendedActions.push(...aiAnalysis.recommended_actions);
          }
          if (aiAnalysis.key_synergies?.length) {
            for (const synergy of aiAnalysis.key_synergies) {
              matchingEvidence.push({
                qualification: 'Key Synergy',
                evidence: synergy,
                confidence: 0.9,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('AI match enrichment skipped or failed:', err.message);
      }
    }

    const now = new Date().toISOString();

    return {
      id: `match-${crypto.randomUUID()}`,
      user_id: profile.id,
      job_id: job.id,
      overall_score: overallScore,
      skills_score: skillsAnalysis.score,
      experience_score: experienceAnalysis.score,
      education_score: educationAnalysis.score,
      language_score: languageAnalysis.score,
      location_score: locationAnalysis.score,
      criteria_weights: weights,
      authorization_compatibility: authAnalysis.compatibility,
      matched_skills: skillsAnalysis.matchedSkills,
      missing_skills: skillsAnalysis.missingSkills,
      matching_evidence: matchingEvidence,
      risk_factors: riskFactors,
      unverified_requirements: unverifiedRequirements,
      recommended_actions: Array.from(new Set(recommendedActions)),
      assessment_model: assessmentModel,
      scoring_version: MatchingEngine.SCORING_VERSION,
      profile_updated_at: profile.updated_at,
      created_at: now,
      updated_at: now,
    };
  }

  // --- Private Sub-Evaluators ---

  private evaluateSkills(
    job: JobListing,
    profile: UserProfile
  ): { score: number; matchedSkills: string[]; missingSkills: string[]; evidence: MatchingEvidence[] } {
    const confirmedSkills = (profile.skills || []).map((s) => s.name.trim().toLowerCase());
    const rawJobSkills = job.required_skills || [];

    if (rawJobSkills.length === 0) {
      // If job does not specify required skills, inspect job description for candidate skills
      const descLower = job.description_raw.toLowerCase();
      const detectedMatches: string[] = [];
      for (const skillObj of profile.skills || []) {
        const skillLower = skillObj.name.trim().toLowerCase();
        if (descLower.includes(skillLower)) {
          detectedMatches.push(skillObj.name);
        }
      }

      const score = detectedMatches.length >= 3 ? 90 : detectedMatches.length > 0 ? 75 : 60;
      return {
        score,
        matchedSkills: detectedMatches,
        missingSkills: [],
        evidence: detectedMatches.map((m) => ({
          qualification: m,
          evidence: `Skill "${m}" appears in job description and matches confirmed candidate skills`,
          confidence: 0.8,
        })),
      };
    }

    const matched: string[] = [];
    const missing: string[] = [];
    const evidence: MatchingEvidence[] = [];

    for (const origReq of rawJobSkills) {
      const reqSkill = origReq.trim().toLowerCase();
      const isMatch = confirmedSkills.some((candSkill) => {
        return (
          candSkill === reqSkill ||
          candSkill.includes(reqSkill) ||
          reqSkill.includes(candSkill) ||
          this.areSkillSynonyms(candSkill, reqSkill)
        );
      });

      if (isMatch) {
        matched.push(origReq);
        const originalCandSkill = profile.skills?.find(
          (s) => s.name.toLowerCase() === reqSkill || reqSkill.includes(s.name.toLowerCase())
        );
        evidence.push({
          qualification: origReq,
          evidence: `Candidate confirmed ${originalCandSkill?.name || origReq} (${originalCandSkill?.years_of_experience || 1}+ yrs experience)`,
          confidence: 0.95,
        });
      } else {
        missing.push(origReq);
      }
    }

    const score = Math.round((matched.length / rawJobSkills.length) * 100);

    return {
      score,
      matchedSkills: matched,
      missingSkills: missing,
      evidence,
    };
  }

  private areSkillSynonyms(a: string, b: string): boolean {
    const synonyms: Record<string, string[]> = {
      ts: ['typescript'],
      js: ['javascript'],
      react: ['react.js', 'reactjs'],
      node: ['node.js', 'nodejs'],
      vue: ['vue.js', 'vuejs'],
      postgres: ['postgresql'],
      k8s: ['kubernetes'],
      py: ['python'],
      flutter: ['dart'],
      aws: ['cloud', 'amazon web services'],
      gcp: ['google cloud', 'google cloud platform'],
    };

    for (const [key, aliases] of Object.entries(synonyms)) {
      if ((a === key || aliases.includes(a)) && (b === key || aliases.includes(b))) {
        return true;
      }
    }
    return false;
  }

  private evaluateExperience(
    job: JobListing,
    profile: UserProfile
  ): { score: number; evidence: MatchingEvidence[] } {
    const experiences = profile.experiences || [];
    if (experiences.length === 0) {
      return {
        score: 40,
        evidence: [
          {
            qualification: 'Work Experience',
            evidence: 'No confirmed prior work experience recorded in profile',
            confidence: 0.7,
          },
        ],
      };
    }

    // Calculate approximate total years of experience
    let totalMonths = 0;
    for (const exp of experiences) {
      const start = new Date(exp.start_date || '2020-01');
      const end = exp.is_current || !exp.end_date ? new Date() : new Date(exp.end_date);
      const diffMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      totalMonths += diffMonths;
    }
    const totalYears = Math.round(totalMonths / 12);

    const titleLower = job.title.toLowerCase();
    const isSeniorJob = titleLower.includes('senior') || titleLower.includes('lead') || titleLower.includes('principal');
    const isJuniorJob = titleLower.includes('junior') || titleLower.includes('entry') || titleLower.includes('intern');

    let score = 75;
    if (isSeniorJob) {
      if (totalYears >= 5) score = 95;
      else if (totalYears >= 3) score = 75;
      else score = 50;
    } else if (isJuniorJob) {
      score = 95;
    } else {
      if (totalYears >= 3) score = 90;
      else if (totalYears >= 1) score = 80;
      else score = 65;
    }

    const latestExp = experiences[0];
    const evidence: MatchingEvidence[] = [
      {
        qualification: 'Professional Experience Duration',
        evidence: `Candidate has ~${totalYears} year(s) of verified professional experience across ${experiences.length} role(s)`,
        confidence: 0.9,
      },
    ];

    if (latestExp) {
      evidence.push({
        qualification: 'Recent Role Relevancy',
        evidence: `Most recent role: ${latestExp.job_title} at ${latestExp.company_name} (${latestExp.is_current ? 'Current' : latestExp.end_date})`,
        confidence: 0.85,
      });
    }

    return { score, evidence };
  }

  private evaluateEducation(
    job: JobListing,
    profile: UserProfile
  ): { score: number; unverified: string[] } {
    const eduList = profile.education || [];
    if (eduList.length === 0) {
      return {
        score: 60,
        unverified: ['Education credentials not provided or unverified in candidate profile'],
      };
    }

    // Candidate has verified higher education
    const highestDegree = eduList[0];
    const degreeLower = (highestDegree.degree_name || '').toLowerCase();
    const isMasterOrAbove = degreeLower.includes('master') || degreeLower.includes('phd') || degreeLower.includes('doctor');
    const isBachelor = degreeLower.includes('bachelor') || degreeLower.includes('licence') || degreeLower.includes('laurea') || degreeLower.includes('bsc') || degreeLower.includes('b.s.');

    const score = isMasterOrAbove ? 100 : isBachelor ? 90 : 80;

    return {
      score,
      unverified: [],
    };
  }

  private evaluateLanguages(
    job: JobListing,
    profile: UserProfile
  ): { score: number; unverified: string[] } {
    const reqLangs = job.required_languages || [];
    const candLangs = (profile.languages || []).map((l) => l.code.toLowerCase());
    const unverified: string[] = [];

    if (reqLangs.length === 0) {
      // Default expectations by country
      const expectedCode = job.country === 'CA' ? 'en' : 'it';
      const hasExpected = candLangs.includes(expectedCode) || candLangs.includes('en');
      if (hasExpected) {
        return { score: 95, unverified: [] };
      }
      unverified.push(`Proficiency in primary country language (${expectedCode.toUpperCase()}) unverified`);
      return { score: 70, unverified };
    }

    let matchedCount = 0;
    for (const req of reqLangs) {
      const code = req.toLowerCase();
      if (candLangs.includes(code)) {
        matchedCount++;
      } else {
        unverified.push(`Required language ${req.toUpperCase()} not confirmed in profile`);
      }
    }

    const score = Math.round((matchedCount / reqLangs.length) * 100);
    return { score: Math.max(40, score), unverified };
  }

  private evaluateLocation(
    job: JobListing,
    profile: UserProfile
  ): { score: number } {
    if (job.is_remote) {
      return { score: 100 };
    }

    const targetCountries = profile.target_countries || [];
    const isTargetCountry = targetCountries.includes(job.country);

    if (isTargetCountry) {
      // Check city or province match if present
      const profileLoc = (profile.location || '').toLowerCase();
      const jobCity = (job.city || '').toLowerCase();
      if (profileLoc && jobCity && profileLoc.includes(jobCity)) {
        return { score: 100 };
      }
      return { score: 85 }; // In country, different city or unstated city
    }

    return { score: 35 }; // Different country entirely
  }

  private evaluateAuthorization(
    job: JobListing,
    profile: UserProfile
  ): { compatibility: AuthorizationCompatibility; unverified: string[] } {
    const auth = profile.work_authorization;
    const country = job.country;
    const unverified: string[] = [];

    if (!auth) {
      unverified.push(`Work authorization for ${country === 'CA' ? 'Canada' : 'Italy'} is unverified by candidate`);
      return { compatibility: 'UNVERIFIED_OR_UNKNOWN', unverified };
    }

    if (country === 'CA') {
      const status = auth.canada_status;
      if (status === 'CITIZEN' || status === 'PERMANENT_RESIDENT' || status === 'WORK_PERMIT') {
        return { compatibility: 'ELIGIBLE', unverified };
      }
      if (status === 'NEED_SPONSORSHIP') {
        return { compatibility: 'NEEDS_SPONSORSHIP', unverified };
      }
      unverified.push('Canadian work authorization status is UNKNOWN or unverified');
      return { compatibility: 'UNVERIFIED_OR_UNKNOWN', unverified };
    }

    if (country === 'IT') {
      const status = auth.italy_status;
      if (status === 'CITIZEN' || status === 'EU_CITIZEN' || status === 'PERMESSO_DI_SOGGIORNO') {
        return { compatibility: 'ELIGIBLE', unverified };
      }
      if (status === 'NEED_SPONSORSHIP') {
        return { compatibility: 'NEEDS_SPONSORSHIP', unverified };
      }
      unverified.push('Italian work authorization status is UNKNOWN or unverified');
      return { compatibility: 'UNVERIFIED_OR_UNKNOWN', unverified };
    }

    return { compatibility: 'UNVERIFIED_OR_UNKNOWN', unverified };
  }
}
