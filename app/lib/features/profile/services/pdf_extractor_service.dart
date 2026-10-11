import 'package:syncfusion_flutter_pdf/pdf.dart';
import '../domain/cv_file.dart';

class PdfExtractionResult {
  final String rawText;
  final int pageCount;
  final int characterCount;
  final bool isScanned;
  final String sha256Checksum;

  const PdfExtractionResult({
    required this.rawText,
    required this.pageCount,
    required this.characterCount,
    this.isScanned = false,
    required this.sha256Checksum,
  });
}

/// Offline, secure PDF extraction engine using pure Dart Syncfusion PDF library.
class PdfExtractorService {
  const PdfExtractorService();

  /// Validates the PDF file bytes and extracts text across all document pages.
  Future<PdfExtractionResult> extractTextFromBytes(CVFile file) async {
    PdfDocument? document;
    try {
      document = PdfDocument(inputBytes: file.bytes);

      if (document.security.userPassword.isNotEmpty ||
          document.security.ownerPassword.isNotEmpty) {
        throw CVValidationException(CVValidationErrorType.passwordProtectedPdf);
      }

      final int pageCount = document.pages.count;
      if (pageCount == 0) {
        throw CVValidationException(CVValidationErrorType.emptyDocument);
      }

      final PdfTextExtractor extractor = PdfTextExtractor(document);
      final String extractedText = extractor.extractText();
      final String trimmedText = extractedText.trim();

      // Detection of scanned documents without vector text layer:
      // If document contains pages but extracted text is empty or less than 25 characters,
      // the document is almost certainly a scanned raster image requiring OCR.
      if (trimmedText.isEmpty || trimmedText.length < 25) {
        throw CVValidationException(
          CVValidationErrorType.scannedImageNoText,
          'This PDF contains $pageCount page(s) but no selectable or vector text could be extracted. It appears to be a scanned image. Optical Character Recognition (OCR) is required to parse this document.',
        );
      }

      return PdfExtractionResult(
        rawText: extractedText,
        pageCount: pageCount,
        characterCount: extractedText.length,
        isScanned: false,
        sha256Checksum: file.sha256Checksum,
      );
    } on CVValidationException {
      rethrow;
    } catch (e) {
      if (e.toString().toLowerCase().contains('password') ||
          e.toString().toLowerCase().contains('encrypt')) {
        throw CVValidationException(CVValidationErrorType.passwordProtectedPdf);
      }
      throw CVValidationException(
        CVValidationErrorType.corruptedPdf,
        'Failed to read PDF structure: ${e.toString()}',
      );
    } finally {
      document?.dispose();
    }
  }
}
