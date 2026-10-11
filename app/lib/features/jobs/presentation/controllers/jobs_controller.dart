import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/job_repository.dart';
import '../../domain/job_listing.dart';

class JobsState {
  final String selectedCountry; // 'ALL' | 'CA' | 'IT'
  final String searchQuery;
  final String location;
  final bool isRemoteOnly;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final List<JobListing> jobs;
  final int total;
  final int page;
  final bool hasMore;
  final List<JobProviderStatusModel> providerStatuses;

  const JobsState({
    this.selectedCountry = 'ALL',
    this.searchQuery = '',
    this.location = '',
    this.isRemoteOnly = false,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.jobs = const [],
    this.total = 0,
    this.page = 1,
    this.hasMore = false,
    this.providerStatuses = const [],
  });

  JobsState copyWith({
    String? selectedCountry,
    String? searchQuery,
    String? location,
    bool? isRemoteOnly,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    bool clearError = false,
    List<JobListing>? jobs,
    int? total,
    int? page,
    bool? hasMore,
    List<JobProviderStatusModel>? providerStatuses,
  }) {
    return JobsState(
      selectedCountry: selectedCountry ?? this.selectedCountry,
      searchQuery: searchQuery ?? this.searchQuery,
      location: location ?? this.location,
      isRemoteOnly: isRemoteOnly ?? this.isRemoteOnly,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      jobs: jobs ?? this.jobs,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      providerStatuses: providerStatuses ?? this.providerStatuses,
    );
  }
}

class JobsController extends Notifier<JobsState> {
  @override
  JobsState build() {
    // Initial fetch on mount
    Future.microtask(() => loadInitial());
    return const JobsState(isLoading: true);
  }

  Future<void> loadInitial() async {
    state = state.copyWith(isLoading: true, clearError: true);
    final repo = ref.read(jobRepositoryProvider);

    try {
      final result = await repo.fetchJobs(
        country: state.selectedCountry,
        query: state.searchQuery,
        location: state.location,
        isRemote: state.isRemoteOnly,
        page: 1,
      );

      state = state.copyWith(
        isLoading: false,
        jobs: result.items,
        total: result.total,
        page: 1,
        hasMore: result.hasMore,
        providerStatuses: result.sourceProviders,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> setCountry(String country) async {
    if (state.selectedCountry == country) return;
    state = state.copyWith(selectedCountry: country, page: 1);
    await loadInitial();
  }

  Future<void> setSearchQuery(String query) async {
    if (state.searchQuery == query) return;
    state = state.copyWith(searchQuery: query, page: 1);
    await loadInitial();
  }

  Future<void> toggleRemote(bool isRemote) async {
    if (state.isRemoteOnly == isRemote) return;
    state = state.copyWith(isRemoteOnly: isRemote, page: 1);
    await loadInitial();
  }

  Future<void> refresh() async {
    await loadInitial();
  }

  Future<void> loadMore() async {
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true);
    final repo = ref.read(jobRepositoryProvider);
    final nextPage = state.page + 1;

    try {
      final result = await repo.fetchJobs(
        country: state.selectedCountry,
        query: state.searchQuery,
        location: state.location,
        isRemote: state.isRemoteOnly,
        page: nextPage,
      );

      state = state.copyWith(
        isLoadingMore: false,
        jobs: [...state.jobs, ...result.items],
        total: result.total,
        page: nextPage,
        hasMore: result.hasMore,
        providerStatuses: result.sourceProviders,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: 'Failed to load more opportunities: $e',
      );
    }
  }
}

final jobsControllerProvider = NotifierProvider<JobsController, JobsState>(
  JobsController.new,
);
