import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:jobpilot/features/jobs/domain/job_listing.dart';
import 'package:jobpilot/features/matching/domain/match_assessment.dart';
import 'package:jobpilot/features/matching/presentation/controllers/matching_controller.dart';
import 'package:jobpilot/features/matching/presentation/widgets/match_score_card.dart';

void main() {
  final sampleJob = JobListing(
    id: 'job-w-1',
    sourceId: 's1',
    sourceProvider: 'test',
    sourceAttribution: 'Test Board',
    title: 'Senior Flutter Architect',
    companyName: 'Acme Systems',
    country: 'CA',
    city: 'Vancouver',
    provinceOrRegion: 'BC',
    isRemote: true,
    contractType: 'FULL_TIME',
    currency: 'CAD',
    descriptionRaw: 'Flutter architecture role.',
    requiredLanguages: const ['en'],
    requiredSkills: const ['Flutter', 'Dart', 'CI/CD'],
    sourceUrl: 'https://example.com/job',
    contentHash: 'hash1',
    status: 'ACTIVE',
    retrievedAt: DateTime.now(),
  );

  testWidgets('MatchScoreCard shows Check Fit button when no assessment is loaded', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: MatchScoreCard(job: sampleJob),
          ),
        ),
      ),
    );

    expect(find.text('Profile Compatibility'), findsOneWidget);
    expect(find.text('Check Fit'), findsOneWidget);
  });

  testWidgets('MatchScoreCard displays scores, badges, and breakdown button when assessment exists', (tester) async {
    const assessment = MatchAssessment(
      id: 'match-w-1',
      userId: 'user-w-1',
      jobId: 'job-w-1',
      overallScore: 88,
      skillsScore: 90,
      experienceScore: 85,
      educationScore: 90,
      languageScore: 100,
      locationScore: 100,
      authorizationCompatibility: AuthorizationCompatibility.eligible,
      matchedSkills: ['Flutter', 'Dart'],
      missingSkills: ['CI/CD'],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          jobMatchingProvider.overrideWith(() => _MockJobMatchingController(assessment)),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: MatchScoreCard(job: sampleJob),
          ),
        ),
      ),
    );

    expect(find.text('88%'), findsOneWidget);
    expect(find.text('Overall Fit'), findsOneWidget);
    expect(find.text('Strong Candidate'), findsOneWidget);
    expect(find.text('Eligible to Work'), findsOneWidget);
    expect(find.text('Flutter'), findsOneWidget);
    expect(find.text('CI/CD'), findsOneWidget);
    expect(find.text('Breakdown'), findsOneWidget);
    expect(find.text('Tailored Docs'), findsOneWidget);
  });
}

class _MockJobMatchingController extends JobMatchingController {
  final MatchAssessment mockAssessment;

  _MockJobMatchingController(this.mockAssessment);

  @override
  JobMatchingState build() {
    return JobMatchingState(
      assessments: {mockAssessment.jobId: mockAssessment},
    );
  }
}
