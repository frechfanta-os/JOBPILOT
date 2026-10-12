import 'package:flutter_test/flutter_test.dart';
import 'package:jobpilot/features/matching/domain/tailored_document.dart';

void main() {
  group('TailoredDocument Domain Model', () {
    test('parses TailoredDocument JSON correctly', () {
      final json = {
        'id': 'doc-123',
        'user_id': 'user-1',
        'job_id': 'job-1',
        'document_type': 'CV',
        'language': 'fr',
        'version_number': 2,
        'title': 'Tailored CV - Shopify (Senior Engineer) [FR]',
        'content_markdown': '# Julien Tremblay\n## Expérience Professionnelle',
        'status': 'REVIEWED',
        'generation_model': 'deterministic-ats-template-v1',
        'generation_notes': 'Generated via deterministic template',
        'created_at': '2026-10-12T08:30:00.000Z',
        'updated_at': '2026-10-12T08:35:00.000Z',
      };

      final doc = TailoredDocument.fromJson(json);

      expect(doc.id, 'doc-123');
      expect(doc.documentType, DocumentType.cv);
      expect(doc.language, 'fr');
      expect(doc.versionNumber, 2);
      expect(doc.status, DocumentStatus.reviewed);
      expect(doc.isApproved, isFalse);
      expect(doc.contentMarkdown, contains('# Julien Tremblay'));
    });

    test('validates DocumentStatus transitions and labels', () {
      expect(DocumentStatus.draft.displayName, 'Initial Draft');
      expect(DocumentStatus.reviewed.displayName, 'Reviewed Draft');
      expect(DocumentStatus.approved.displayName, 'Approved by You');

      final approvedDoc = TailoredDocument(
        id: 'doc-approved',
        userId: 'u1',
        jobId: 'j1',
        documentType: DocumentType.coverLetter,
        language: 'it',
        versionNumber: 1,
        title: 'Cover Letter',
        contentMarkdown: 'Egregio Team...',
        status: DocumentStatus.approved,
        generationModel: 'local-test',
      );

      expect(approvedDoc.isApproved, isTrue);
      expect(approvedDoc.documentType.displayName, 'Cover Letter');
    });
  });
}
