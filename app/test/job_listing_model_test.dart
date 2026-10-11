import 'package:flutter_test/flutter_test.dart';
import 'package:jobpilot/features/jobs/domain/job_listing.dart';

void main() {
  group('JobListing Domain Model Tests', () {
    test('JobListing.fromJson parses full payload correctly', () {
      final json = {
        'id': 'job_test_1',
        'source_id': 'remotive_123',
        'source_provider': 'REMOTIVE',
        'source_attribution': 'Remotive (Official Remote Jobs API)',
        'title': 'Senior Flutter Engineer',
        'company_name': 'Acme Canada Corp',
        'country': 'CA',
        'city': 'Montreal',
        'province_or_region': 'Quebec',
        'is_remote': true,
        'contract_type': 'FULL_TIME',
        'salary_min': 100000,
        'salary_max': 130000,
        'currency': 'CAD',
        'description_raw': 'Clean description here',
        'description_summary': 'Short summary',
        'required_languages': ['en', 'fr'],
        'required_skills': ['Flutter', 'Dart'],
        'source_url': 'https://example.com/jobs/123',
        'application_url': 'https://example.com/apply/123',
        'content_hash': 'sha256_dummy_hash',
        'status': 'ACTIVE',
        'published_at': '2026-10-10T12:00:00Z',
        'retrieved_at': '2026-10-11T12:00:00Z',
      };

      final job = JobListing.fromJson(json);

      expect(job.id, 'job_test_1');
      expect(job.title, 'Senior Flutter Engineer');
      expect(job.companyName, 'Acme Canada Corp');
      expect(job.country, 'CA');
      expect(job.countryFlag, '🇨🇦');
      expect(job.isRemote, isTrue);
      expect(job.formattedSalary, '\$100k - \$130k CAD');
      expect(job.formattedLocation, 'Montreal 🇨🇦 (Remote)');
      expect(job.primaryActionUrl, 'https://example.com/apply/123');
      expect(job.requiredLanguages, contains('fr'));
    });

    test('JobListing formattedSalary handles null and single bound values', () {
      final jobNoSalary = JobListing(
        id: '1',
        sourceId: '1',
        sourceProvider: 'ARBEITNOW',
        sourceAttribution: 'Arbeitnow',
        title: 'Developer',
        companyName: 'EuroTech',
        country: 'IT',
        city: 'Milano',
        provinceOrRegion: 'Lombardia',
        isRemote: false,
        contractType: 'FULL_TIME',
        currency: 'EUR',
        descriptionRaw: 'Desc',
        requiredLanguages: ['it'],
        requiredSkills: [],
        sourceUrl: 'https://example.com',
        contentHash: 'hash',
        status: 'ACTIVE',
        retrievedAt: DateTime(2026, 10, 11),
      );

      expect(jobNoSalary.formattedSalary, isNull);
      expect(jobNoSalary.countryFlag, '🇮🇹');
      expect(jobNoSalary.formattedLocation, 'Milano 🇮🇹');

      final jobMinSalaryOnly = JobListing(
        id: '2',
        sourceId: '2',
        sourceProvider: 'ARBEITNOW',
        sourceAttribution: 'Arbeitnow',
        title: 'Developer',
        companyName: 'EuroTech',
        country: 'IT',
        city: 'Milano',
        provinceOrRegion: 'Lombardia',
        isRemote: false,
        contractType: 'FULL_TIME',
        salaryMin: 50000,
        currency: 'EUR',
        descriptionRaw: 'Desc',
        requiredLanguages: const ['it'],
        requiredSkills: const [],
        sourceUrl: 'https://example.com',
        contentHash: 'hash2',
        status: 'ACTIVE',
        retrievedAt: DateTime(2026, 10, 11),
      );

      expect(jobMinSalaryOnly.formattedSalary, 'from €50k EUR');
    });

    test('JobDiscoveryResult.fromJson parses items and provider statuses', () {
      final json = {
        'items': [
          {
            'id': 'job_1',
            'source_id': '1',
            'source_provider': 'REMOTIVE',
            'source_attribution': 'Remotive',
            'title': 'Job 1',
            'company_name': 'Co',
            'country': 'CA',
            'city': 'Toronto',
            'province_or_region': 'ON',
            'is_remote': true,
            'contract_type': 'FULL_TIME',
            'currency': 'CAD',
            'description_raw': 'Desc',
            'source_url': 'https://example.com',
            'content_hash': 'hash',
            'status': 'ACTIVE',
          }
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
        'has_more': false,
        'source_providers': [
          {
            'name': 'Remotive',
            'coverage': 'Worldwide Remote',
            'status': 'ACTIVE',
          },
          {
            'name': 'Adzuna',
            'coverage': 'Canada & Italy',
            'status': 'BLOCKED',
            'reason': 'API key not configured',
          }
        ],
      };

      final result = JobDiscoveryResult.fromJson(json);

      expect(result.items.length, 1);
      expect(result.total, 1);
      expect(result.hasMore, isFalse);
      expect(result.sourceProviders.length, 2);
      expect(result.sourceProviders[0].isActive, isTrue);
      expect(result.sourceProviders[1].isBlocked, isTrue);
    });
  });
}
