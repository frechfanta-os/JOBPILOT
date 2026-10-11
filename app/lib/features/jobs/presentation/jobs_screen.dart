import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/widgets/state_views.dart';
import 'controllers/jobs_controller.dart';
import 'widgets/job_card.dart';
import 'widgets/job_detail_sheet.dart';

class JobsScreen extends ConsumerStatefulWidget {
  const JobsScreen({super.key});

  @override
  ConsumerState<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends ConsumerState<JobsScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final jobsState = ref.watch(jobsControllerProvider);
    final controller = ref.read(jobsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Job Discovery'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => controller.refresh(),
            tooltip: 'Refresh Feeds',
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Search Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search roles, skills, employers...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          controller.setSearchQuery('');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onSubmitted: (value) => controller.setSearchQuery(value.trim()),
            ),
          ),

          // 2. Filter Chips: Countries & Remote
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
            child: Row(
              children: [
                FilterChip(
                  label: const Text('All Countries'),
                  selected: jobsState.selectedCountry == 'ALL',
                  onSelected: (_) => controller.setCountry('ALL'),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Canada 🇨🇦'),
                  selected: jobsState.selectedCountry == 'CA',
                  onSelected: (_) => controller.setCountry('CA'),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Italy 🇮🇹'),
                  selected: jobsState.selectedCountry == 'IT',
                  onSelected: (_) => controller.setCountry('IT'),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  avatar: const Icon(Icons.wifi, size: 14),
                  label: const Text('Remote Only'),
                  selected: jobsState.isRemoteOnly,
                  onSelected: (val) => controller.toggleRemote(val),
                ),
              ],
            ),
          ),

          // 3. Provider Status Banner (Transparency Disclosure)
          if (jobsState.providerStatuses.isNotEmpty)
            _buildProviderDisclosure(context, jobsState.providerStatuses),

          const Divider(height: 1),

          // 4. Job Listings Feed / States
          Expanded(
            child: _buildFeedContent(context, jobsState, controller),
          ),
        ],
      ),
    );
  }

  Widget _buildProviderDisclosure(BuildContext context, List<dynamic> providers) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final activeCount = providers.where((p) => p.status == 'ACTIVE').length;
    final blockedCount = providers.where((p) => p.status == 'BLOCKED').length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
      child: Row(
        children: [
          Icon(Icons.hub_outlined, size: 14, color: colorScheme.primary),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              '$activeCount active live source${activeCount != 1 ? 's' : ''}'
              '${blockedCount > 0 ? ' ($blockedCount require API keys)' : ''}',
              style: theme.textTheme.labelSmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeedContent(BuildContext context, JobsState state, JobsController controller) {
    if (state.isLoading) {
      return const LoadingStateView(
        message: 'Querying verified opportunities for Canada & Italy...',
      );
    }

    if (state.error != null && state.jobs.isEmpty) {
      return ErrorStateView(
        title: 'Discovery Error',
        errorMessage: state.error!,
        onRetry: () => controller.refresh(),
      );
    }

    if (state.jobs.isEmpty) {
      return EmptyStateView(
        icon: Icons.search_off,
        title: 'No Matching Jobs Found',
        message: 'No open positions matched your criteria for ${state.selectedCountry}. '
            'Try broadening your search keywords or switching countries.',
        actionLabel: 'Reset Filters',
        onAction: () {
          _searchController.clear();
          controller.setSearchQuery('');
          controller.setCountry('ALL');
          controller.toggleRemote(false);
        },
      );
    }

    return RefreshIndicator(
      onRefresh: () => controller.refresh(),
      child: NotificationListener<ScrollNotification>(
        onNotification: (scrollInfo) {
          if (scrollInfo.metrics.pixels >= scrollInfo.metrics.maxScrollExtent - 200) {
            controller.loadMore();
          }
          return false;
        },
        child: ListView.builder(
          itemCount: state.jobs.length + (state.isLoadingMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == state.jobs.length) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 16.0),
                child: Center(child: CircularProgressIndicator()),
              );
            }

            final job = state.jobs[index];
            return JobCard(
              job: job,
              onTap: () => JobDetailSheet.show(context, job),
            );
          },
        ),
      ),
    );
  }
}
