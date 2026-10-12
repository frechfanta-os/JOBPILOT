import 'package:flutter_test/flutter_test.dart';
import 'package:jobpilot/features/matching/domain/match_assessment.dart';

void main() {
  group('MatchAssessment Domain Model', () {
    test('parses complete MatchAssessment JSON correctly', () {
      final json = {
        'id': 'match-test-1',
        'user_id': 'user-123',
        'job_id': 'job-456',
        'overall_score': 82,
        'skills_score': 85,
        'experience_score': 80,
        'education_score': 90,
        'language_score': 100,
        'location_score': 75,
        'criteria_weights': {
          'skills': 0.40,
          'experience': 0.25,
          'education': 0.15,
          'language': 0.10,
          'location': 0.10,
        },
        'authorization_compatibility': 'ELIGIBLE',
        'matched_skills': ['Flutter', 'Dart', 'TypeScript'],
        'missing_skills': ['Docker'],
        'matching_evidence': [
          {
            'qualification': 'Flutter',
            'evidence': 'Candidate confirmed 4+ yrs experience in Flutter',
            'confidence': 0.95,
          }
        ],
        'risk_factors': ['Missing required skill: Docker'],
        'unverified_requirements': [],
        'recommended_actions': ['Emphasize transferable container experience'],
        'assessment_model': 'openai/gpt-4o-mini+deterministic-v1',
        'scoring_version': 'v1.0-deterministic-ai-enriched',
        'created_at': '2026-10-12T08:00:00.000Z',
        'updated_at': '2026-10-12T08:00:00.000Z',
      };

      final assessment = MatchAssessment.fromJson(json);

      expect(assessment.id, 'match-test-1');
      expect(assessment.overallScore, 82);
      expect(assessment.isHighMatch, isTrue);
      expect(assessment.isModerateMatch, isFalse);
      expect(assessment.isLowMatch, isFalse);
      expect(assessment.authorizationCompatibility, AuthorizationCompatibility.eligible);
      expect(assessment.matchedSkills, ['Flutter', 'Dart', 'TypeScript']);
      expect(assessment.missingSkills, ['Docker']);
      expect(assessment.matchingEvidence.length, 1);
      expect(assessment.matchingEvidence.first.qualification, 'Flutter');
      expect(assessment.criteriaWeights.skills, 0.40);
      expect(assessment.scoringVersion, 'v1.0-deterministic-ai-enriched');
    });

    test('serializes back to JSON preserving fields', () {
      const assessment = MatchAssessment(
        id: 'match-2',
        userId: 'u1',
        jobId: 'j1',
        overallScore: 65,
        skillsScore: 60,
        experienceScore: 70,
        educationScore: 70,
        languageScore: 80,
        locationScore: 50,
        authorizationCompatibility: AuthorizationCompatibility.needsSponsorship,
        matchedSkills: ['Python'],
        missingSkills: ['C++'],
      );

      expect(assessment.isHighMatch, isFalse);
      expect(assessment.isModerateMatch, isTrue);

      final json = assessment.toJson();
      expect(json['id'], 'match-2');
      expect(json['overall_score'], 65);
      expect(json['authorization_compatibility'], 'NEEDS_SPONSORSHIP');
      expect(json['matched_skills'], ['Python']);
      expect(json['missing_skills'], ['C++']);
    });

    test('handles unknown and unverified authorization safely', () {
      final compat = AuthorizationCompatibility.fromString('SOME_UNKNOWN_STRING');
      expect(compat, AuthorizationCompatibility.unverifiedOrUnknown);
      expect(compat.label, 'Unverified / Unknown');
    });
  });
}
