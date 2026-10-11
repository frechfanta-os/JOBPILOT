import 'dart:typed_data';
import 'package:crypto/crypto.dart';

enum CVValidationErrorType {
  invalidExtension,
  invalidMagicBytes,
  fileTooLarge,
  corruptedPdf,
  passwordProtectedPdf,
  scannedImageNoText,
  emptyDocument,
  genericError;

  String get localizedMessage {
    switch (this) {
      case CVValidationErrorType.invalidExtension:
        return 'The selected file must be a PDF document (.pdf).';
      case CVValidationErrorType.invalidMagicBytes:
        return 'The file does not appear to be a valid PDF document (invalid file header).';
      case CVValidationErrorType.fileTooLarge:
        return 'The file exceeds the maximum allowed size of 10 MB.';
      case CVValidationErrorType.corruptedPdf:
        return 'The PDF file is damaged or corrupted and cannot be read.';
      case CVValidationErrorType.passwordProtectedPdf:
        return 'This PDF is encrypted or password-protected. Please provide an unencrypted version.';
      case CVValidationErrorType.scannedImageNoText:
        return 'This document appears to be a scanned image without selectable text. Optical Character Recognition (OCR) is required to process it.';
      case CVValidationErrorType.emptyDocument:
        return 'The document contains no readable text pages.';
      case CVValidationErrorType.genericError:
        return 'An error occurred while processing the CV document.';
    }
  }
}

class CVValidationException implements Exception {
  final CVValidationErrorType errorType;
  final String message;

  CVValidationException(this.errorType, [String? customMessage])
      : message = customMessage ?? errorType.localizedMessage;

  @override
  String toString() => 'CVValidationException: $message ($errorType)';
}

/// Represents an inspected and validated CV file on the device.
class CVFile {
  final String filename;
  final int sizeBytes;
  final Uint8List bytes;
  final String sha256Checksum;
  final String? localPath;

  CVFile({
    required this.filename,
    required this.sizeBytes,
    required this.bytes,
    required this.sha256Checksum,
    this.localPath,
  });

  static const int maxFileSize = 10 * 1024 * 1024; // 10 MB
  static const List<int> pdfMagicBytes = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-

  /// Factory validator verifying extension, magic bytes, and size cap.
  static CVFile validateAndCreate({
    required String filename,
    required Uint8List bytes,
    String? localPath,
  }) {
    // 1. Extension check
    if (!filename.toLowerCase().endsWith('.pdf')) {
      throw CVValidationException(CVValidationErrorType.invalidExtension);
    }

    // 2. Size check
    if (bytes.length > maxFileSize) {
      throw CVValidationException(
        CVValidationErrorType.fileTooLarge,
        'File size (${(bytes.length / (1024 * 1024)).toStringAsFixed(1)} MB) exceeds 10 MB limit.',
      );
    }

    if (bytes.length < 5) {
      throw CVValidationException(CVValidationErrorType.emptyDocument);
    }

    // 3. Magic bytes signature check (%PDF-)
    for (int i = 0; i < pdfMagicBytes.length; i++) {
      if (bytes[i] != pdfMagicBytes[i]) {
        throw CVValidationException(CVValidationErrorType.invalidMagicBytes);
      }
    }

    // 4. Compute cryptographic SHA-256
    final checksum = sha256.convert(bytes).toString();

    return CVFile(
      filename: filename,
      sizeBytes: bytes.length,
      bytes: bytes,
      sha256Checksum: checksum,
      localPath: localPath,
    );
  }

  String get formattedSize {
    if (sizeBytes < 1024) return '$sizeBytes B';
    if (sizeBytes < 1024 * 1024) return '${(sizeBytes / 1024).toStringAsFixed(1)} KB';
    return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
