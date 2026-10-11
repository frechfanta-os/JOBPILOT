import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:jobpilot/features/jobs/data/job_repository.dart';
import 'package:jobpilot/features/jobs/domain/job_listing.dart';
import 'package:jobpilot/features/jobs/presentation/jobs_screen.dart';

class FakeJobRepository implements JobRepository {
  final List<JobListing> mockJobs;
  final bool shouldFail;

  FakeJobRepository({this.mockJobs = const [], this.shouldFail = false});

  @override
  Future<JobDiscoveryResult> fetchJobs({
    String country = 'ALL',
    String query = '',
    String location = '',
    bool isRemote = false,
    int page = 1,
    int limit = 20,
    String? authToken,
  }) async {
    if (shouldFail) {
      throw Exception('Network connection failed');
    }

    final filtered = mockJobs.where((j) {
      if (country != 'ALL' && j.country != country) return false;
      if (isRemote && !j.isRemote) return false;
      if (query.isNotEmpty && !j.title.toLowerCase().contains(query.toLowerCase())) return false;
      return true;
    }).toList();

    return JobDiscoveryResult(
      items: filtered,
      total: filtered.length,
      page: 1,
      limit: 20,
      hasMore: false,
      sourceProviders: const [
        JobProviderStatusModel(name: 'Remotive', coverage: 'Remote', status: 'ACTIVE'),
        JobProviderStatusModel(name: 'Adzuna', coverage: 'Canada', status: 'BLOCKED', reason: 'Missing keys'),
      ],
    );
  }

  @override
  Future<JobListing?> getJobById(String id, {String? authToken}) async {
    return mockJobs.cast<JobListing?>().firstWhere((j) => j?.id == id, orElse: () => null);
  }
}

void main() {
  final sampleJob = JobListing(
    id: 'job_sample_1',
    sourceId: '101',
    sourceProvider: 'REMOTIVE',
    sourceAttribution: 'Remotive (Official Remote Jobs API)',
    title: 'Lead Flutter Architect',
    companyName: 'CloudTech Canada',
    country: 'CA',
    city: 'Montreal',
    provinceOrRegion: 'QC',
    isRemote: true,
    contractType: 'FULL_TIME',
    salaryMin: 120000,
    salaryMax: 150000,
    currency: 'CAD',
    descriptionRaw: 'Lead our cross-platform architecture.',
    descriptionSummary: 'Lead our cross-platform architecture.',
    requiredLanguages: const ['en', 'fr'],
    requiredSkills: const ['Flutter', 'Riverpod'],
    sourceUrl: 'https://example.com/job/101',
    applicationUrl: 'https://example.com/apply/101',
    contentHash: 'hash_101',
    status: 'ACTIVE',
    publishedAt: DateTime.now(),
    retrievedAt: DateTime.now(),
  );

  testWidgets('JobsScreen renders search, filter chips, and populated job cards', (tester) async {
    final fakeRepo = FakeJobRepository(mockJobs: [sampleJob]);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          jobRepositoryProvider.overrideWithValue(fakeRepo),
        ],
        child: const MaterialApp(
          home: JobsScreen(),
        ),
      ),
    );

    // Initial pump and wait for microtask loadInitial
    await tester.pump();
    await tester.pumpAndSettle();

    // Verify AppBar and Controls
    expect(find.text('Job Discovery'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('All Countries'), findsOneWidget);
    expect(find.text('Canada 🇨🇦'), findsOneWidget);
    expect(find.text('Italy 🇮🇹'), findsOneWidget);
    expect(find.text('Remote Only'), findsOneWidget);

    // Verify Job Card Content
    expect(find.text('Lead Flutter Architect'), findsOneWidget);
    expect(find.text('CloudTech Canada'), findsOneWidget);
    expect(find.text('Remotive (Official Remote Jobs API)'), findsOneWidget);
    expect(find.text('\$120k - \$150k CAD'), findsOneWidget);
  });

  testWidgets('JobsScreen displays EmptyStateView when no jobs match filter', (tester) async {
    final fakeRepo = FakeJobRepository(mockJobs: []);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          jobRepositoryProvider.overrideWithValue(fakeRepo),
        ],
        child: const MaterialApp(
          home: JobsScreen(),
        ),
      ),
    );

    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('No Matching Jobs Found'), findsOneWidget);
    expect(find.text('Reset Filters'), findsOneWidget);
  });

  testWidgets('JobsScreen displays ErrorStateView on network failure', (tester) async {
    final fakeRepo = FakeJobRepository(shouldFail: true);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          jobRepositoryProvider.overrideWithValue(fakeRepo),
        ],
        child: const MaterialApp(
          home: JobsScreen(),
        ),
      ),
    );

    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('Discovery Error'), findsOneWidget);
    expect(find.text('Try Again'), findsOneWidget);
  });
}
