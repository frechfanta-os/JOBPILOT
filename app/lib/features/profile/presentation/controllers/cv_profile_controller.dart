import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/cv_file.dart';
import '../../domain/structured_profile.dart';
import '../../services/pdf_extractor_service.dart';
import '../../services/deterministic_cv_parser.dart';

enum CVProcessStatus {
  initial,
  selecting,
  validating,
  extracting,
  reviewing,
  saving,
  success,
  error;
}

class CVProfileState {
  final CVProcessStatus status;
  final CVFile? selectedFile;
  final PdfExtractionResult? extractionResult;
  final UserProfile? profile;
  final String? errorMessage;
  final CVValidationErrorType? errorType;

  const CVProfileState({
    this.status = CVProcessStatus.initial,
    this.selectedFile,
    this.extractionResult,
    this.profile,
    this.errorMessage,
    this.errorType,
  });

  bool get isLoading =>
      status == CVProcessStatus.selecting ||
      status == CVProcessStatus.validating ||
      status == CVProcessStatus.extracting ||
      status == CVProcessStatus.saving;

  CVProfileState copyWith({
    CVProcessStatus? status,
    CVFile? selectedFile,
    PdfExtractionResult? extractionResult,
    UserProfile? profile,
    String? errorMessage,
    CVValidationErrorType? errorType,
  }) {
    return CVProfileState(
      status: status ?? this.status,
      selectedFile: selectedFile ?? this.selectedFile,
      extractionResult: extractionResult ?? this.extractionResult,
      profile: profile ?? this.profile,
      errorMessage: errorMessage,
      errorType: errorType,
    );
  }
}

class CVProfileNotifier extends Notifier<CVProfileState> {
  final PdfExtractorService _extractorService;
  final DeterministicCVParser _parser;

  CVProfileNotifier({
    PdfExtractorService? extractorService,
    DeterministicCVParser? parser,
  })  : _extractorService = extractorService ?? const PdfExtractorService(),
        _parser = parser ?? const DeterministicCVParser();

  @override
  CVProfileState build() {
    return const CVProfileState();
  }

  /// Triggers Android system file picker for PDF documents.
  Future<void> pickAndProcessFile() async {
    if (state.isLoading) return; // Prevent duplicate rapid taps

    state = state.copyWith(status: CVProcessStatus.selecting, errorMessage: null);

    try {
      final List<PlatformFile> files = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );

      if (files.isEmpty) {
        // User cancelled picker
        state = state.copyWith(status: CVProcessStatus.initial);
        return;
      }

      final platformFile = files.first;
      final Uint8List bytes = await platformFile.xFile.readAsBytes();
      if (bytes.isEmpty) {
        throw CVValidationException(
          CVValidationErrorType.emptyDocument,
          'The selected file is empty.',
        );
      }

      await processFileBytes(
        bytes: bytes,
        filename: platformFile.name,
        localPath: platformFile.path,
      );
    } on CVValidationException catch (e) {
      state = state.copyWith(
        status: CVProcessStatus.error,
        errorMessage: e.message,
        errorType: e.errorType,
      );
    } catch (e) {
      state = state.copyWith(
        status: CVProcessStatus.error,
        errorMessage: 'File selection error: ${e.toString()}',
        errorType: CVValidationErrorType.genericError,
      );
    }
  }

  /// Validates, extracts, and parses PDF bytes into a candidate profile draft.
  Future<void> processFileBytes({
    required Uint8List bytes,
    required String filename,
    String? localPath,
  }) async {
    try {
      // 1. Validation Step
      state = state.copyWith(status: CVProcessStatus.validating, errorMessage: null);
      final cvFile = CVFile.validateAndCreate(
        filename: filename,
        bytes: bytes,
        localPath: localPath,
      );

      // 2. Text Extraction Step
      state = state.copyWith(
        status: CVProcessStatus.extracting,
        selectedFile: cvFile,
      );

      final extraction = await _extractorService.extractTextFromBytes(cvFile);

      // 3. Deterministic Parsing Step
      final parsedProfile = _parser.parse(
        extraction.rawText,
        cvDocumentId: cvFile.sha256Checksum.substring(0, 16),
      );

      state = state.copyWith(
        status: CVProcessStatus.reviewing,
        selectedFile: cvFile,
        extractionResult: extraction,
        profile: parsedProfile,
      );
    } on CVValidationException catch (e) {
      state = state.copyWith(
        status: CVProcessStatus.error,
        errorMessage: e.message,
        errorType: e.errorType,
      );
    } catch (e) {
      state = state.copyWith(
        status: CVProcessStatus.error,
        errorMessage: 'Document processing error: ${e.toString()}',
        errorType: CVValidationErrorType.genericError,
      );
    }
  }

  /// Updates profile fields corrected by the user in the review UI.
  void updateProfile(UserProfile updated) {
    state = state.copyWith(profile: updated);
  }

  /// Confirms the candidate profile, setting `isConfirmedByUser = true`.
  Future<void> confirmAndSaveProfile() async {
    if (state.profile == null || state.isLoading) return;

    state = state.copyWith(status: CVProcessStatus.saving);

    try {
      final confirmed = state.profile!.copyWith(
        isConfirmedByUser: true,
        updatedAt: DateTime.now(),
      );

      state = state.copyWith(
        status: CVProcessStatus.success,
        profile: confirmed,
      );
    } catch (e) {
      state = state.copyWith(
        status: CVProcessStatus.error,
        errorMessage: 'Failed to save profile: ${e.toString()}',
      );
    }
  }

  void reset() {
    state = const CVProfileState();
  }
}

final cvProfileProvider =
    NotifierProvider<CVProfileNotifier, CVProfileState>(CVProfileNotifier.new);
