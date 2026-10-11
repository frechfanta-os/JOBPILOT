import 'package:flutter_test/flutter_test.dart';
import 'package:jobpilot/features/profile/services/deterministic_cv_parser.dart';

void main() {
  group('DeterministicCVParser Unit Tests', () {
    const parser = DeterministicCVParser();

    test('extracts structured profile from rich technical CV text', () {
      const sampleCvText = '''
Alexandre Martin
alexandre.martin@example.com
+1 514-555-0199
Montreal, Canada
Senior Flutter & Cloud Architect

Summary
Experienced mobile and cloud architect specializing in high-performance cross-platform applications and distributed serverless microservices.

Experience
Lead Mobile Architect
Acme Corp | 2022 - Present
Designed and engineered enterprise Flutter applications using Riverpod, TypeScript and Cloudflare Workers.

Software Engineer
TechSolutions Inc | 2019 - 2022
Built REST API backend services and iOS / Android applications.

Education
Bachelor in Computer Engineering
Polytechnique Montreal | 2019

Skills
Flutter, Dart, TypeScript, Docker, PostgreSQL, Cloudflare, Git, CI/CD, REST API

Languages
English (Fluent), French (Native), Italian
''';

      final profile = parser.parse(sampleCvText, userId: 'usr_test_123', cvDocumentId: 'doc_cv_123');

      expect(profile.id, 'usr_test_123');
      expect(profile.cvDocumentId, 'doc_cv_123');
      expect(profile.email, 'alexandre.martin@example.com');
      expect(profile.phoneNumber, '+1 514-555-0199');
      expect(profile.firstName, 'Alexandre');
      expect(profile.lastName, 'Martin');
      expect(profile.location, 'Montreal');
      expect(profile.headline, contains('Senior Flutter'));
      expect(profile.summary, isNotEmpty);
      expect(profile.targetCountries, contains('CA'));
      expect(profile.isConfirmedByUser, isFalse);

      // Verify skills extracted
      final skillNames = profile.skills.map((s) => s.name).toList();
      expect(skillNames, contains('Flutter'));
      expect(skillNames, contains('Dart'));
      expect(skillNames, contains('TypeScript'));
      expect(skillNames, contains('Cloudflare'));

      // Verify languages
      final langCodes = profile.languages.map((l) => l.code).toList();
      expect(langCodes, contains('en'));
      expect(langCodes, contains('fr'));
      expect(langCodes, contains('it'));

      // Verify experiences and education
      expect(profile.experiences.isNotEmpty, isTrue);
      expect(profile.education.isNotEmpty, isTrue);

      // Missing fields should not include email or full_name
      expect(profile.missingFields.contains('email'), isFalse);
      expect(profile.missingFields.contains('full_name'), isFalse);
    });

    test('detects missing fields and flags low confidence for sparse CV text', () {
      const sparseCv = '''
Some Random Notes
No contact details here
Just interested in work
''';

      final profile = parser.parse(sparseCv);

      expect(profile.email, isEmpty);
      expect(profile.phoneNumber, isEmpty);
      expect(profile.missingFields, contains('email'));
      expect(profile.missingFields, contains('phone_number'));
      expect(profile.missingFields, contains('skills'));
      expect(profile.lowConfidenceFields, contains('experiences'));
      expect(profile.lowConfidenceFields, contains('education'));
    });

    test('detects Italian language and country target', () {
      const italianCv = '''
Marco Rossi
marco.rossi@example.it
+39 02 1234567
Milano, Italia
Sviluppatore Software

Esperienza
Ingegnere del Software
Azienda Milano | 2021 - Presente
Sviluppo di applicazioni con Flutter e TypeScript.

Istruzione
Laurea in Informatica
Università degli Studi di Milano | 2020

Competenze
Flutter, Dart, Docker, SQL

Lingue
Italiano, Inglese
''';

      final profile = parser.parse(italianCv);

      expect(profile.firstName, 'Marco');
      expect(profile.lastName, 'Rossi');
      expect(profile.email, 'marco.rossi@example.it');
      expect(profile.location, 'Milano');
      expect(profile.targetCountries, contains('IT'));
      expect(profile.primaryLanguage, 'it');
      final langCodes = profile.languages.map((l) => l.code).toList();
      expect(langCodes, contains('it'));
      expect(langCodes, contains('en'));
    });
  });
}
