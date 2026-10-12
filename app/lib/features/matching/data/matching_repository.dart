import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../jobs/domain/job_listing.dart';
import '../../profile/domain/structured_profile.dart';
import '../domain/match_assessment.dart';
import '../domain/tailored_document.dart';

abstract class MatchingRepository {
  Future<MatchAssessment> assessMatch(
    String jobId, {
    String? authToken,
    JobListing? jobFallback,
    UserProfile? profileFallback,
    bool skipAiEnrichment = false,
  });

  Future<MatchAssessment?> getMatchByJob(String jobId, {String? authToken});

  Future<TailoredDocument> generateTailoredDocument({
    required String jobId,
    required DocumentType documentType,
    required String language,
    String? authToken,
    JobListing? jobFallback,
    UserProfile? profileFallback,
  });

  Future<List<TailoredDocument>> listTailoredDocuments(String jobId, {String? authToken});

  Future<TailoredDocument> updateTailoredDocument({
    required String docId,
    required String contentMarkdown,
    String? title,
    String? authToken,
  });

  Future<TailoredDocument> approveTailoredDocument({
    required String docId,
    String? authToken,
  });
}

class BackendMatchingRepository implements MatchingRepository {
  final String baseUrl;
  final http.Client client;

  BackendMatchingRepository({
    this.baseUrl = AppConstants.defaultApiBaseUrl,
    http.Client? client,
  }) : client = client ?? http.Client();

  @override
  Future<MatchAssessment> assessMatch(
    String jobId, {
    String? authToken,
    JobListing? jobFallback,
    UserProfile? profileFallback,
    bool skipAiEnrichment = false,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/matches/assess');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    try {
      final response = await client
          .post(
            uri,
            headers: headers,
            body: jsonEncode({
              'job_id': jobId,
              'options': {'skipAiEnrichment': skipAiEnrichment},
            }),
          )
          .timeout(const Duration(seconds: 12));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['success'] == true && decoded['data'] != null) {
          return MatchAssessment.fromJson(decoded['data'] as Map<String, dynamic>);
        }
      }
    } catch (_) {
      // Fallback to local computation
    }

    if (jobFallback != null && profileFallback != null) {
      return computeLocalMatch(jobFallback, profileFallback);
    }

    throw Exception('Failed to assess match: backend unreachable and no fallback data provided');
  }

  @override
  Future<MatchAssessment?> getMatchByJob(String jobId, {String? authToken}) async {
    final uri = Uri.parse('$baseUrl/api/v1/matches/by-job/$jobId');
    final headers = <String, String>{
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    try {
      final response = await client.get(uri, headers: headers).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['success'] == true && decoded['data'] != null) {
          return MatchAssessment.fromJson(decoded['data'] as Map<String, dynamic>);
        }
      }
    } catch (_) {}
    return null;
  }

  @override
  Future<TailoredDocument> generateTailoredDocument({
    required String jobId,
    required DocumentType documentType,
    required String language,
    String? authToken,
    JobListing? jobFallback,
    UserProfile? profileFallback,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/documents/tailored');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    try {
      final response = await client
          .post(
            uri,
            headers: headers,
            body: jsonEncode({
              'job_id': jobId,
              'document_type': documentType.code,
              'language': language,
            }),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['success'] == true && decoded['data'] != null) {
          return TailoredDocument.fromJson(decoded['data'] as Map<String, dynamic>);
        }
      }
    } catch (_) {
      // Fallback to client-side document generation
    }

    if (jobFallback != null && profileFallback != null) {
      return generateLocalDocument(
        job: jobFallback,
        profile: profileFallback,
        type: documentType,
        language: language,
      );
    }

    throw Exception('Failed to generate tailored document: backend unavailable and no fallback');
  }

  @override
  Future<List<TailoredDocument>> listTailoredDocuments(String jobId, {String? authToken}) async {
    final uri = Uri.parse('$baseUrl/api/v1/documents/tailored?job_id=$jobId');
    final headers = <String, String>{
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    try {
      final response = await client.get(uri, headers: headers).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['success'] == true && decoded['data'] != null) {
          final items = decoded['data']['items'] as List<dynamic>? ?? [];
          return items.map((e) => TailoredDocument.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}
    return [];
  }

  @override
  Future<TailoredDocument> updateTailoredDocument({
    required String docId,
    required String contentMarkdown,
    String? title,
    String? authToken,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/documents/tailored/$docId');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    final response = await client
        .put(
          uri,
          headers: headers,
          body: jsonEncode({
            'content_markdown': contentMarkdown,
            'title': ?title,
          }),
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      if (decoded['success'] == true && decoded['data'] != null) {
        return TailoredDocument.fromJson(decoded['data'] as Map<String, dynamic>);
      }
    }
    throw Exception('Failed to update document: HTTP ${response.statusCode}');
  }

  @override
  Future<TailoredDocument> approveTailoredDocument({
    required String docId,
    String? authToken,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/documents/tailored/$docId/approve');
    final headers = <String, String>{
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    final response = await client.post(uri, headers: headers).timeout(const Duration(seconds: 8));
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      if (decoded['success'] == true && decoded['data'] != null) {
        return TailoredDocument.fromJson(decoded['data'] as Map<String, dynamic>);
      }
    }
    throw Exception('Failed to approve document: HTTP ${response.statusCode}');
  }

  // --- Local Offline Evaluator Fallback ---

  static MatchAssessment computeLocalMatch(JobListing job, UserProfile profile) {
    final candSkills = profile.skills.map((s) => s.name.trim().toLowerCase()).toList();
    final reqSkills = job.requiredSkills;

    final matched = <String>[];
    final missing = <String>[];
    for (final req in reqSkills) {
      final reqLower = req.trim().toLowerCase();
      final hasMatch = candSkills.any((c) => c == reqLower || c.contains(reqLower) || reqLower.contains(c));
      if (hasMatch) {
        matched.add(req);
      } else {
        missing.add(req);
      }
    }

    final skillsScore = reqSkills.isEmpty ? 80 : ((matched.length / reqSkills.length) * 100).round();
    final expScore = profile.experiences.isNotEmpty ? 85 : 50;
    final eduScore = profile.education.isNotEmpty ? 90 : 60;
    final langScore = 100;
    final locScore = job.isRemote ? 100 : (profile.targetCountries.contains(job.country) ? 90 : 40);

    final overall = (skillsScore * 0.40 + expScore * 0.25 + eduScore * 0.15 + langScore * 0.10 + locScore * 0.10).round();

    final authStatus = job.country == 'CA'
        ? profile.workAuthorization.canadaStatus
        : profile.workAuthorization.italyStatus;

    final isEligible = authStatus == 'CITIZEN' || authStatus == 'PERMANENT_RESIDENT' || authStatus == 'EU_CITIZEN';
    final authCompat = isEligible
        ? AuthorizationCompatibility.eligible
        : (authStatus == 'NEED_SPONSORSHIP'
            ? AuthorizationCompatibility.needsSponsorship
            : AuthorizationCompatibility.unverifiedOrUnknown);

    return MatchAssessment(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      userId: profile.id,
      jobId: job.id,
      overallScore: overall,
      skillsScore: skillsScore,
      experienceScore: expScore,
      educationScore: eduScore,
      languageScore: langScore,
      locationScore: locScore,
      authorizationCompatibility: authCompat,
      matchedSkills: matched,
      missingSkills: missing,
      matchingEvidence: [
        MatchingEvidence(
          qualification: 'Skills Evaluation',
          evidence: '${matched.length} of ${reqSkills.length} required skills confirmed in profile',
        ),
      ],
      riskFactors: missing.isNotEmpty ? ['Missing skills: ${missing.join(', ')}'] : [],
      unverifiedRequirements: authCompat == AuthorizationCompatibility.unverifiedOrUnknown
          ? ['Work authorization status for ${job.country} is unconfirmed']
          : [],
      recommendedActions: [
        'Highlight confirmed achievements relevant to ${job.title}',
      ],
      assessmentModel: 'local-deterministic-v1',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  static TailoredDocument generateLocalDocument({
    required JobListing job,
    required UserProfile profile,
    required DocumentType type,
    required String language,
  }) {
    final isCoverLetter = type == DocumentType.coverLetter;
    final title = isCoverLetter
        ? 'Cover Letter - ${job.companyName} (${job.title}) [${language.toUpperCase()}]'
        : 'Tailored CV - ${job.companyName} (${job.title}) [${language.toUpperCase()}]';

    final buffer = StringBuffer();
    if (isCoverLetter) {
      buffer.writeln(profile.fullName);
      buffer.writeln('${profile.email} • ${profile.location}');
      buffer.writeln('\n${DateTime.now().toLocal().toString().split(' ')[0]}');
      buffer.writeln('\nTo the Hiring Team at ${job.companyName},');
      buffer.writeln('\n**Application for ${job.title}**\n');
      buffer.writeln('I am writing to express my strong interest in the ${job.title} role at ${job.companyName}.');
      if (profile.experiences.isNotEmpty) {
        buffer.writeln('With verified experience as a ${profile.experiences.first.jobTitle}, I bring focused skills in ${profile.skills.take(3).map((s) => s.name).join(', ')}.');
      }
      buffer.writeln('\nThank you for considering my application.\n\nSincerely,\n${profile.fullName}');
    } else {
      buffer.writeln('# ${profile.fullName}');
      buffer.writeln('**${profile.headline.isNotEmpty ? profile.headline : job.title}**');
      buffer.writeln('${profile.email} • ${profile.phoneNumber} • ${profile.location}\n---');
      buffer.writeln('\n## Professional Summary');
      buffer.writeln(profile.summary.isNotEmpty ? profile.summary : 'Targeting the ${job.title} position at ${job.companyName}.');
      if (profile.skills.isNotEmpty) {
        buffer.writeln('\n## Core Competencies');
        buffer.writeln(profile.skills.map((s) => s.name).join(' • '));
      }
      if (profile.experiences.isNotEmpty) {
        buffer.writeln('\n## Experience');
        for (final exp in profile.experiences) {
          buffer.writeln('### ${exp.jobTitle} | ${exp.companyName}');
          buffer.writeln('*${exp.startDate} - ${exp.isCurrent ? 'Present' : exp.endDate}*');
          buffer.writeln(exp.description);
        }
      }
    }

    return TailoredDocument(
      id: 'local-doc-${DateTime.now().millisecondsSinceEpoch}',
      userId: profile.id,
      jobId: job.id,
      documentType: type,
      language: language,
      versionNumber: 1,
      title: title,
      contentMarkdown: buffer.toString().trim(),
      status: DocumentStatus.draft,
      generationModel: 'local-deterministic-template-v1',
      generationNotes: 'Generated locally on device with strict factual profile grounding',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }
}

final matchingRepositoryProvider = Provider<MatchingRepository>((ref) {
  return BackendMatchingRepository();
});
