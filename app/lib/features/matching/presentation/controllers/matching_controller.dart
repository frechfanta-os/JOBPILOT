import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../jobs/domain/job_listing.dart';
import '../../../profile/presentation/controllers/cv_profile_controller.dart';
import '../../data/matching_repository.dart';
import '../../domain/match_assessment.dart';
import '../../domain/tailored_document.dart';

// --- Job Matching State & Controller ---

class JobMatchingState {
  final Map<String, MatchAssessment> assessments;
  final Set<String> loadingJobIds;
  final String? errorMessage;

  const JobMatchingState({
    this.assessments = const {},
    this.loadingJobIds = const {},
    this.errorMessage,
  });

  bool isJobLoading(String jobId) => loadingJobIds.contains(jobId);
  MatchAssessment? getAssessment(String jobId) => assessments[jobId];

  JobMatchingState copyWith({
    Map<String, MatchAssessment>? assessments,
    Set<String>? loadingJobIds,
    String? errorMessage,
  }) {
    return JobMatchingState(
      assessments: assessments ?? this.assessments,
      loadingJobIds: loadingJobIds ?? this.loadingJobIds,
      errorMessage: errorMessage,
    );
  }
}

class JobMatchingController extends Notifier<JobMatchingState> {
  @override
  JobMatchingState build() {
    return const JobMatchingState();
  }

  Future<void> loadExistingMatch(String jobId) async {
    if (state.assessments.containsKey(jobId)) return;

    final repo = ref.read(matchingRepositoryProvider);
    try {
      final existing = await repo.getMatchByJob(jobId);
      if (existing != null) {
        state = state.copyWith(
          assessments: {...state.assessments, jobId: existing},
        );
      }
    } catch (_) {}
  }

  Future<void> assessMatch(JobListing job, {bool skipAi = false}) async {
    final repo = ref.read(matchingRepositoryProvider);
    final userProfile = ref.read(cvProfileProvider).profile;

    state = state.copyWith(
      loadingJobIds: {...state.loadingJobIds, job.id},
      errorMessage: null,
    );

    try {
      final result = await repo.assessMatch(
        job.id,
        jobFallback: job,
        profileFallback: userProfile,
        skipAiEnrichment: skipAi,
      );

      final nextLoading = Set<String>.from(state.loadingJobIds)..remove(job.id);
      state = state.copyWith(
        assessments: {...state.assessments, job.id: result},
        loadingJobIds: nextLoading,
      );
    } catch (e) {
      final nextLoading = Set<String>.from(state.loadingJobIds)..remove(job.id);
      state = state.copyWith(
        loadingJobIds: nextLoading,
        errorMessage: e.toString(),
      );
    }
  }
}

final jobMatchingProvider =
    NotifierProvider<JobMatchingController, JobMatchingState>(
  JobMatchingController.new,
);

// --- Tailored Documents State & Controller ---

class TailoredDocsState {
  final Map<String, List<TailoredDocument>> documentsByJob;
  final Set<String> loadingJobIds;
  final Set<String> generatingJobIds;
  final TailoredDocument? currentSelectedDoc;
  final String? errorMessage;

  const TailoredDocsState({
    this.documentsByJob = const {},
    this.loadingJobIds = const {},
    this.generatingJobIds = const {},
    this.currentSelectedDoc,
    this.errorMessage,
  });

  bool isLoading(String jobId) => loadingJobIds.contains(jobId);
  bool isGenerating(String jobId) => generatingJobIds.contains(jobId);
  List<TailoredDocument> getDocuments(String jobId) => documentsByJob[jobId] ?? const [];

  TailoredDocsState copyWith({
    Map<String, List<TailoredDocument>>? documentsByJob,
    Set<String>? loadingJobIds,
    Set<String>? generatingJobIds,
    TailoredDocument? currentSelectedDoc,
    String? errorMessage,
  }) {
    return TailoredDocsState(
      documentsByJob: documentsByJob ?? this.documentsByJob,
      loadingJobIds: loadingJobIds ?? this.loadingJobIds,
      generatingJobIds: generatingJobIds ?? this.generatingJobIds,
      currentSelectedDoc: currentSelectedDoc ?? this.currentSelectedDoc,
      errorMessage: errorMessage,
    );
  }
}

class TailoredDocsController extends Notifier<TailoredDocsState> {
  @override
  TailoredDocsState build() {
    return const TailoredDocsState();
  }

  Future<void> loadDocuments(String jobId) async {
    final repo = ref.read(matchingRepositoryProvider);
    state = state.copyWith(
      loadingJobIds: {...state.loadingJobIds, jobId},
      errorMessage: null,
    );

    try {
      final docs = await repo.listTailoredDocuments(jobId);
      final nextLoading = Set<String>.from(state.loadingJobIds)..remove(jobId);
      state = state.copyWith(
        documentsByJob: {...state.documentsByJob, jobId: docs},
        loadingJobIds: nextLoading,
        currentSelectedDoc: docs.isNotEmpty ? docs.first : null,
      );
    } catch (e) {
      final nextLoading = Set<String>.from(state.loadingJobIds)..remove(jobId);
      state = state.copyWith(
        loadingJobIds: nextLoading,
        errorMessage: e.toString(),
      );
    }
  }

  Future<TailoredDocument?> generateDocument({
    required JobListing job,
    required DocumentType type,
    required String language,
  }) async {
    final repo = ref.read(matchingRepositoryProvider);
    final userProfile = ref.read(cvProfileProvider).profile;

    state = state.copyWith(
      generatingJobIds: {...state.generatingJobIds, job.id},
      errorMessage: null,
    );

    try {
      final newDoc = await repo.generateTailoredDocument(
        jobId: job.id,
        documentType: type,
        language: language,
        jobFallback: job,
        profileFallback: userProfile,
      );

      final currentDocs = state.documentsByJob[job.id] ?? [];
      final updatedDocs = [newDoc, ...currentDocs];
      final nextGenerating = Set<String>.from(state.generatingJobIds)..remove(job.id);

      state = state.copyWith(
        documentsByJob: {...state.documentsByJob, job.id: updatedDocs},
        generatingJobIds: nextGenerating,
        currentSelectedDoc: newDoc,
      );
      return newDoc;
    } catch (e) {
      final nextGenerating = Set<String>.from(state.generatingJobIds)..remove(job.id);
      state = state.copyWith(
        generatingJobIds: nextGenerating,
        errorMessage: e.toString(),
      );
      return null;
    }
  }

  Future<bool> updateDocumentContent({
    required String jobId,
    required String docId,
    required String newMarkdown,
    String? title,
  }) async {
    final repo = ref.read(matchingRepositoryProvider);
    try {
      final updated = await repo.updateTailoredDocument(
        docId: docId,
        contentMarkdown: newMarkdown,
        title: title,
      );

      final currentDocs = state.documentsByJob[jobId] ?? [];
      final updatedList = currentDocs.map((d) => d.id == docId ? updated : d).toList();

      state = state.copyWith(
        documentsByJob: {...state.documentsByJob, jobId: updatedList},
        currentSelectedDoc: state.currentSelectedDoc?.id == docId ? updated : state.currentSelectedDoc,
      );
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> approveDocument({
    required String jobId,
    required String docId,
  }) async {
    final repo = ref.read(matchingRepositoryProvider);
    try {
      final approved = await repo.approveTailoredDocument(docId: docId);

      final currentDocs = state.documentsByJob[jobId] ?? [];
      final updatedList = currentDocs.map((d) => d.id == docId ? approved : d).toList();

      state = state.copyWith(
        documentsByJob: {...state.documentsByJob, jobId: updatedList},
        currentSelectedDoc: state.currentSelectedDoc?.id == docId ? approved : state.currentSelectedDoc,
      );
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  void selectDocument(TailoredDocument doc) {
    state = state.copyWith(currentSelectedDoc: doc);
  }
}

final tailoredDocsProvider =
    NotifierProvider<TailoredDocsController, TailoredDocsState>(
  TailoredDocsController.new,
);
