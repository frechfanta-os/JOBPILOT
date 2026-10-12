import { Env } from '../../types/env.js';
import {
  JobListing,
  UserProfile,
  TailoredDocument,
  DocumentType,
  LocaleCode,
} from '../../types/domain.js';
import { OpenRouterClient } from '../ai/openrouter_client.js';

export interface GenerateDocumentOptions {
  job: JobListing;
  profile: UserProfile;
  documentType: DocumentType;
  language: LocaleCode;
  versionNumber?: number;
}

export class TailoredDocumentGenerator {
  private openRouterClient = new OpenRouterClient();

  /**
   * Generates a tailored document (CV or Cover Letter) grounded in confirmed facts.
   */
  async generateDocument(
    options: GenerateDocumentOptions,
    env: Env
  ): Promise<TailoredDocument> {
    const { job, profile, documentType, language, versionNumber = 1 } = options;

    let contentMarkdown: string | null = null;
    let generationModel = 'deterministic-ats-template-v1';
    let generationNotes = 'Generated via deterministic ATS structured template';

    // 1. Attempt AI generation if OpenRouter is configured
    if (OpenRouterClient.isConfigured(env)) {
      try {
        if (documentType === 'CV') {
          contentMarkdown = await this.openRouterClient.generateTailoredCvMarkdown(job, profile, language, env);
        } else {
          contentMarkdown = await this.openRouterClient.generateCoverLetterMarkdown(job, profile, language, env);
        }

        if (contentMarkdown) {
          generationModel = 'openai/gpt-4o-mini+ats-grounded';
          generationNotes = 'Generated using OpenAI GPT-4o-mini via OpenRouter with zero-hallucination factual guardrails';
        }
      } catch (err: any) {
        console.warn('OpenRouter document generation failed or timed out, falling back to deterministic template:', err.message);
      }
    }

    // 2. Fallback to deterministic template if AI was not configured or failed
    if (!contentMarkdown) {
      if (documentType === 'CV') {
        contentMarkdown = this.buildDeterministicCvMarkdown(job, profile, language);
      } else {
        contentMarkdown = this.buildDeterministicCoverLetterMarkdown(job, profile, language);
      }
    }

    const now = new Date().toISOString();
    const docId = `doc-${crypto.randomUUID()}`;
    const title =
      documentType === 'CV'
        ? `Tailored CV - ${job.company_name} (${job.title}) [${language.toUpperCase()}]`
        : `Cover Letter - ${job.company_name} (${job.title}) [${language.toUpperCase()}]`;

    return {
      id: docId,
      user_id: profile.id,
      job_id: job.id,
      document_type: documentType,
      language,
      version_number: versionNumber,
      title,
      content_markdown: contentMarkdown,
      status: 'DRAFT',
      generation_model: generationModel,
      generation_notes: generationNotes,
      created_at: now,
      updated_at: now,
    };
  }

  // --- Multilingual ATS Deterministic Generators ---

  private buildDeterministicCvMarkdown(job: JobListing, profile: UserProfile, lang: LocaleCode): string {
    const fullName = `${profile.first_name} ${profile.last_name}`.trim() || 'Candidate';
    const headline = profile.headline || job.title;
    const email = profile.email;
    const phone = profile.phone_number || '';
    const loc = profile.location || '';

    // Language labels
    const t = {
      en: {
        summary: 'Professional Summary',
        experience: 'Professional Experience',
        skills: 'Core Competencies & Technical Skills',
        education: 'Education & Credentials',
        languages: 'Languages',
        present: 'Present',
      },
      fr: {
        summary: 'Profil Professionnel',
        experience: 'Expérience Professionnelle',
        skills: 'Compétences & Maîtrise Technique',
        education: 'Formation & Diplômes',
        languages: 'Langues',
        present: 'Présent',
      },
      it: {
        summary: 'Profilo Professionale',
        experience: 'Esperienza Lavorativa',
        skills: 'Competenze Tecniche & Professionali',
        education: 'Istruzione & Formazione',
        languages: 'Competenze Linguistiche',
        present: 'Presente',
      },
    }[lang];

    const contactLine = [email, phone, loc].filter(Boolean).join(' | ');

    let md = `# ${fullName}\n\n`;
    md += `**${headline}**\n\n`;
    if (contactLine) {
      md += `${contactLine}\n\n`;
    }
    md += `---\n\n`;

    // Summary tailored to the job
    md += `## ${t.summary}\n\n`;
    if (profile.summary) {
      md += `${profile.summary}\n\n`;
    } else {
      if (lang === 'fr') {
        md += `Professionnel qualifié ciblant le rôle de **${job.title}** chez **${job.company_name}**. Fort engagement envers l'excellence technique, la rigueur opérationnelle et l'atteinte des objectifs de performance.\n\n`;
      } else if (lang === 'it') {
        md += `Professionista motivato con competenze mirate al ruolo di **${job.title}** presso **${job.company_name}**. Solida etica del lavoro, orientamento ai risultati e collaborazione efficace.\n\n`;
      } else {
        md += `Results-driven professional targeting the **${job.title}** position at **${job.company_name}**. Dedicated to technical excellence, continuous improvement, and delivering high-impact solutions.\n\n`;
      }
    }

    // Skills
    if (profile.skills && profile.skills.length > 0) {
      md += `## ${t.skills}\n\n`;
      const skillNames = profile.skills.map((s) => s.name);
      md += `${skillNames.join(' • ')}\n\n`;
    }

    // Experience
    if (profile.experiences && profile.experiences.length > 0) {
      md += `## ${t.experience}\n\n`;
      for (const exp of profile.experiences) {
        const period = `${exp.start_date} – ${exp.is_current ? t.present : exp.end_date || t.present}`;
        md += `### ${exp.job_title} | ${exp.company_name}\n`;
        md += `*${period}* ${exp.location ? `| *${exp.location}*` : ''}\n\n`;
        if (exp.description) {
          md += `${exp.description}\n\n`;
        }
        if (exp.technologies && exp.technologies.length > 0) {
          md += `*Key technologies:* ${exp.technologies.join(', ')}\n\n`;
        }
      }
    }

    // Education
    if (profile.education && profile.education.length > 0) {
      md += `## ${t.education}\n\n`;
      for (const edu of profile.education) {
        md += `### ${edu.degree_name}\n`;
        md += `**${edu.institution}**${edu.graduation_year ? ` (${edu.graduation_year})` : ''}\n`;
        if (edu.field_of_study) {
          md += `*Field of study: ${edu.field_of_study}*\n\n`;
        } else {
          md += `\n`;
        }
      }
    }

    // Languages
    if (profile.languages && profile.languages.length > 0) {
      md += `## ${t.languages}\n\n`;
      const langItems = profile.languages.map((l) => `${l.name || l.code.toUpperCase()} (${l.proficiency || 'Professional'})`);
      md += `${langItems.join(' • ')}\n\n`;
    }

    return md.trim();
  }

  private buildDeterministicCoverLetterMarkdown(job: JobListing, profile: UserProfile, lang: LocaleCode): string {
    const fullName = `${profile.first_name} ${profile.last_name}`.trim() || 'Candidate';
    const email = profile.email;
    const phone = profile.phone_number || '';
    const loc = profile.location || '';
    const dateFormatted = new Date().toLocaleDateString(lang === 'fr' ? 'fr-CA' : lang === 'it' ? 'it-IT' : 'en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const contactHeader = [fullName, email, phone, loc].filter(Boolean).join('\n');

    if (lang === 'fr') {
      return `${contactHeader}

${dateFormatted}

À l'attention du comité de recrutement
${job.company_name}
${job.city ? `${job.city}, ` : ''}${job.country === 'CA' ? 'Canada' : 'Italie'}

**Objet : Candidature pour le poste de ${job.title}**

Madame, Monsieur,

Je vous adresse ma candidature pour l'opportunité de **${job.title}** au sein de **${job.company_name}**. Ayant suivi avec intérêt l'évolution de vos activités, je suis convaincu que mes compétences et mon parcours professionnel correspondent aux exigences de cette fonction.

Au cours de mes expériences professionnelles passées${profile.experiences?.length ? ` (notamment en tant que ${profile.experiences[0].job_title})` : ''}, j'ai développé une solide expertise dans ${profile.skills?.slice(0, 3).map((s) => s.name).join(', ') || 'les technologies appliquées'}. Mon approche est fondée sur la rigueur, l'autonomie et la recherche constante de qualité.

Intégrer **${job.company_name}** représente pour moi une opportunité de contribuer activement à vos projets tout en relevant de nouveaux défis au sein d'une équipe dynamique.

Je me tiens à votre entière disposition pour tout entretien à votre convenance.

Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

**${fullName}**`;
    }

    if (lang === 'it') {
      return `${contactHeader}

${dateFormatted}

Alla cortese attenzione del Responsabile delle Risorse Umane
${job.company_name}
${job.city ? `${job.city}, ` : ''}${job.country === 'IT' ? 'Italia' : 'Canada'}

**Oggetto: Candidatura per la posizione di ${job.title}**

Gentile Team di Selezione,

Con la presente desidero sottoporre la mia candidatura per la posizione di **${job.title}** presso **${job.company_name}**. Sono rimasto molto colpito dai vostri risultati e desidero mettere la mia esperienza a disposizione della vostra realtà.

Nel mio percorso professionale${profile.experiences?.length ? ` (in particolare nel ruolo di ${profile.experiences[0].job_title})` : ''}, ho consolidato competenze pratiche in ${profile.skills?.slice(0, 3).map((s) => s.name).join(', ') || 'ambiti chiave del settore'}, lavorando sempre con attenzione al dettaglio, orientamento agli obiettivi e forte spirito di squadra.

Sono entusiasta all'idea di poter collaborare con **${job.company_name}** e contribuire attivamente al successo dei vostri progetti.

Resto a disposizione per un colloquio conoscitivo per approfondire il mio profilo.

Cordiali saluti,

**${fullName}**`;
    }

    // Default English
    return `${contactHeader}

${dateFormatted}

Hiring Team
${job.company_name}
${job.city ? `${job.city}, ` : ''}${job.country === 'CA' ? 'Canada' : 'Italy'}

**RE: Application for ${job.title}**

Dear Hiring Team,

I am writing to express my strong interest in the **${job.title}** role at **${job.company_name}**. Given my background and technical qualifications, I am excited about the opportunity to contribute effectively to your team's ongoing initiatives.

Throughout my professional experience${profile.experiences?.length ? ` (most recently as ${profile.experiences[0].job_title})` : ''}, I have developed core capabilities in ${profile.skills?.slice(0, 3).map((s) => s.name).join(', ') || 'modern engineering and problem solving'}. I prioritize clear communication, robust engineering standards, and collaborative execution.

The mission of **${job.company_name}** strongly resonates with my professional goals, and I am eager to apply my strengths to deliver reliable and impactful results for your organization.

Thank you for your time and consideration. I welcome the opportunity to discuss how my experience aligns with your team's objectives in an interview.

Sincerely,

**${fullName}**`;
  }
}
