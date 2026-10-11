import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobpilot/features/profile/domain/cv_file.dart';

void main() {
  group('CVFile Validation and Security Checks', () {
    final validPdfBytes = Uint8List.fromList([
      0x25, 0x50, 0x44, 0x46, 0x2D, // %PDF-
      0x31, 0x2E, 0x37, 0x0A, 0x25,
      ...List.filled(100, 0x20),
    ]);

    test('accepts valid PDF bytes and computes SHA-256 checksum', () {
      final cv = CVFile.validateAndCreate(
        filename: 'resume_alex_martin.pdf',
        bytes: validPdfBytes,
        localPath: '/storage/emulated/0/Download/resume_alex_martin.pdf',
      );

      expect(cv.filename, 'resume_alex_martin.pdf');
      expect(cv.sizeBytes, validPdfBytes.length);
      expect(cv.sha256Checksum, isNotEmpty);
      expect(cv.sha256Checksum.length, 64); // 64 hex characters
      expect(cv.localPath, '/storage/emulated/0/Download/resume_alex_martin.pdf');
      expect(cv.formattedSize, isNotEmpty);
    });

    test('rejects non-PDF extension', () {
      expect(
        () => CVFile.validateAndCreate(
          filename: 'cv.docx',
          bytes: validPdfBytes,
        ),
        throwsA(
          isA<CVValidationException>().having(
            (e) => e.errorType,
            'errorType',
            CVValidationErrorType.invalidExtension,
          ),
        ),
      );
    });

    test('rejects file with invalid magic bytes (spoofed PDF extension)', () {
      final spoofedBytes = Uint8List.fromList([
        0x50, 0x4B, 0x03, 0x04, // ZIP header instead of %PDF-
        0x00, 0x00, 0x00, 0x00,
      ]);

      expect(
        () => CVFile.validateAndCreate(
          filename: 'fake.pdf',
          bytes: spoofedBytes,
        ),
        throwsA(
          isA<CVValidationException>().having(
            (e) => e.errorType,
            'errorType',
            CVValidationErrorType.invalidMagicBytes,
          ),
        ),
      );
    });

    test('rejects empty or truncated document (< 5 bytes)', () {
      final truncatedBytes = Uint8List.fromList([0x25, 0x50]);

      expect(
        () => CVFile.validateAndCreate(
          filename: 'empty.pdf',
          bytes: truncatedBytes,
        ),
        throwsA(
          isA<CVValidationException>().having(
            (e) => e.errorType,
            'errorType',
            CVValidationErrorType.emptyDocument,
          ),
        ),
      );
    });

    test('rejects files exceeding 10 MB limit', () {
      // 10 MB + 1 byte
      final oversizedBytes = Uint8List(CVFile.maxFileSize + 1);
      oversizedBytes[0] = 0x25;
      oversizedBytes[1] = 0x50;
      oversizedBytes[2] = 0x44;
      oversizedBytes[3] = 0x46;
      oversizedBytes[4] = 0x2D;

      expect(
        () => CVFile.validateAndCreate(
          filename: 'giant_cv.pdf',
          bytes: oversizedBytes,
        ),
        throwsA(
          isA<CVValidationException>().having(
            (e) => e.errorType,
            'errorType',
            CVValidationErrorType.fileTooLarge,
          ),
        ),
      );
    });
  });
}
