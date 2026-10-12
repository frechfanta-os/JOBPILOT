class CriteriaWeights {
  final double skills;
  final double experience;
  final double education;
  final double language;
  final double location;

  const CriteriaWeights({
    this.skills = 0.40,
    this.experience = 0.25,
    this.education = 0.15,
    this.language = 0.10,
    this.location = 0.10,
  });

  factory CriteriaWeights.fromJson(Map<String, dynamic> json) {
    return CriteriaWeights(
      skills: (json['skills'] as num?)?.toDouble() ?? 0.40,
      experience: (json['experience'] as num?)?.toDouble() ?? 0.25,
      education: (json['education'] as num?)?.toDouble() ?? 0.15,
      language: (json['language'] as num?)?.toDouble() ?? 0.10,
      location: (json['location'] as num?)?.toDouble() ?? 0.10,
    );
  }

  Map<String, dynamic> toJson() => {
    'skills': skills,
    'experience': experience,
    'education': education,
    'language': language,
    'location': location,
  };
}

class MatchingEvidence {
  final String qualification;
  final String evidence;
  final double confidence;

  const MatchingEvidence({
    required this.qualification,
    required this.evidence,
    this.confidence = 1.0,
  });

  factory MatchingEvidence.fromJson(Map<String, dynamic> json) {
    return MatchingEvidence(
      qualification: json['qualification'] as String? ?? '',
      evidence: json['evidence'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'qualification': qualification,
    'evidence': evidence,
    'confidence': confidence,
  };
}

enum AuthorizationCompatibility {
  eligible,
  needsSponsorship,
  unverifiedOrUnknown,
  ineligible;

  static AuthorizationCompatibility fromString(String val) {
    switch (val.toUpperCase()) {
      case 'ELIGIBLE':
        return AuthorizationCompatibility.eligible;
      case 'NEEDS_SPONSORSHIP':
        return AuthorizationCompatibility.needsSponsorship;
      case 'INELIGIBLE':
        return AuthorizationCompatibility.ineligible;
      case 'UNVERIFIED_OR_UNKNOWN':
      default:
        return AuthorizationCompatibility.unverifiedOrUnknown;
    }
  }

  String get code {
    switch (this) {
      case AuthorizationCompatibility.eligible:
        return 'ELIGIBLE';
      case AuthorizationCompatibility.needsSponsorship:
        return 'NEEDS_SPONSORSHIP';
      case AuthorizationCompatibility.unverifiedOrUnknown:
        return 'UNVERIFIED_OR_UNKNOWN';
      case AuthorizationCompatibility.ineligible:
        return 'INELIGIBLE';
    }
  }

  String get label {
    switch (this) {
      case AuthorizationCompatibility.eligible:
        return 'Eligible to Work';
      case AuthorizationCompatibility.needsSponsorship:
        return 'Needs Sponsorship';
      case AuthorizationCompatibility.ineligible:
        return 'Ineligible';
      case AuthorizationCompatibility.unverifiedOrUnknown:
        return 'Unverified / Unknown';
    }
  }
}

class MatchAssessment {
  final String id;
  final String userId;
  final String jobId;
  final int overallScore; // 0 - 100
  final int skillsScore;
  final int experienceScore;
  final int educationScore;
  final int languageScore;
  final int locationScore;
  final CriteriaWeights criteriaWeights;
  final AuthorizationCompatibility authorizationCompatibility;
  final List<String> matchedSkills;
  final List<String> missingSkills;
  final List<MatchingEvidence> matchingEvidence;
  final List<String> riskFactors;
  final List<String> unverifiedRequirements;
  final List<String> recommendedActions;
  final String assessmentModel;
  final String scoringVersion;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const MatchAssessment({
    required this.id,
    required this.userId,
    required this.jobId,
    required this.overallScore,
    required this.skillsScore,
    required this.experienceScore,
    required this.educationScore,
    required this.languageScore,
    required this.locationScore,
    this.criteriaWeights = const CriteriaWeights(),
    this.authorizationCompatibility = AuthorizationCompatibility.unverifiedOrUnknown,
    this.matchedSkills = const [],
    this.missingSkills = const [],
    this.matchingEvidence = const [],
    this.riskFactors = const [],
    this.unverifiedRequirements = const [],
    this.recommendedActions = const [],
    this.assessmentModel = 'deterministic-rules-v1',
    this.scoringVersion = 'v1.0-deterministic',
    this.createdAt,
    this.updatedAt,
  });

  bool get isHighMatch => overallScore >= 75;
  bool get isModerateMatch => overallScore >= 50 && overallScore < 75;
  bool get isLowMatch => overallScore < 50;

  factory MatchAssessment.fromJson(Map<String, dynamic> json) {
    return MatchAssessment(
      id: json['id'] as String? ?? '',
      userId: json['user_id'] as String? ?? '',
      jobId: json['job_id'] as String? ?? '',
      overallScore: (json['overall_score'] as num?)?.toInt() ?? 0,
      skillsScore: (json['skills_score'] as num?)?.toInt() ?? 0,
      experienceScore: (json['experience_score'] as num?)?.toInt() ?? 0,
      educationScore: (json['education_score'] as num?)?.toInt() ?? 0,
      languageScore: (json['language_score'] as num?)?.toInt() ?? 0,
      locationScore: (json['location_score'] as num?)?.toInt() ?? 0,
      criteriaWeights: json['criteria_weights'] != null
          ? CriteriaWeights.fromJson(json['criteria_weights'] as Map<String, dynamic>)
          : const CriteriaWeights(),
      authorizationCompatibility: AuthorizationCompatibility.fromString(
        json['authorization_compatibility'] as String? ?? 'UNVERIFIED_OR_UNKNOWN',
      ),
      matchedSkills: (json['matched_skills'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      missingSkills: (json['missing_skills'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      matchingEvidence: (json['matching_evidence'] as List<dynamic>?)
              ?.map((e) => MatchingEvidence.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      riskFactors: (json['risk_factors'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      unverifiedRequirements:
          (json['unverified_requirements'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      recommendedActions:
          (json['recommended_actions'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      assessmentModel: json['assessment_model'] as String? ?? 'deterministic-rules-v1',
      scoringVersion: json['scoring_version'] as String? ?? 'v1.0-deterministic',
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
      updatedAt: json['updated_at'] != null ? DateTime.tryParse(json['updated_at'] as String) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'job_id': jobId,
    'overall_score': overallScore,
    'skills_score': skillsScore,
    'experience_score': experienceScore,
    'education_score': educationScore,
    'language_score': languageScore,
    'location_score': locationScore,
    'criteria_weights': criteriaWeights.toJson(),
    'authorization_compatibility': authorizationCompatibility.code,
    'matched_skills': matchedSkills,
    'missing_skills': missingSkills,
    'matching_evidence': matchingEvidence.map((e) => e.toJson()).toList(),
    'risk_factors': riskFactors,
    'unverified_requirements': unverifiedRequirements,
    'recommended_actions': recommendedActions,
    'assessment_model': assessmentModel,
    'scoring_version': scoringVersion,
    'created_at': createdAt?.toIso8601String(),
    'updated_at': updatedAt?.toIso8601String(),
  };
}
