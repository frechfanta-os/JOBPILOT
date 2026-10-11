import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/widgets/state_views.dart';
import '../../domain/cv_file.dart';
import '../controllers/cv_profile_controller.dart';

class CVImportScreen extends ConsumerWidget {
  const CVImportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(cvProfileProvider);
    final notifier = ref.read(cvProfileProvider.notifier);
    final theme = Theme.of(context);

    // If successfully reviewed, automatically route to profile review
    ref.listen<CVProfileState>(cvProfileProvider, (previous, next) {
      if (next.status == CVProcessStatus.reviewing) {
        context.push('/profile-review');
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Import CV (PDF)'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            // Header Instruction
            Card(
              elevation: 0,
              color: theme.colorScheme.primaryContainer.withAlpha(70),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Icon(Icons.shield_outlined, color: theme.colorScheme.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Offline & Private: Your CV is processed securely. Missing facts are never invented.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Main Interactive Area
            Expanded(
              child: _buildBody(context, state, notifier),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    CVProfileState state,
    CVProfileNotifier notifier,
  ) {
    final theme = Theme.of(context);

    if (state.isLoading) {
      String loadingText = 'Processing...';
      if (state.status == CVProcessStatus.selecting) {
        loadingText = 'Selecting file from device...';
      } else if (state.status == CVProcessStatus.validating) {
        loadingText = 'Validating PDF signature and size limits...';
      } else if (state.status == CVProcessStatus.extracting) {
        loadingText = 'Extracting vector text from document...';
      }
      return LoadingStateView(message: loadingText);
    }

    if (state.status == CVProcessStatus.error) {
      final isScanned = state.errorType == CVValidationErrorType.scannedImageNoText;
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            isScanned ? Icons.document_scanner_outlined : Icons.error_outline,
            size: 64,
            color: isScanned ? const Color(0xFFD97706) : theme.colorScheme.error,
          ),
          const SizedBox(height: 16),
          Text(
            isScanned ? 'Scanned Document Detected' : 'Validation Error',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: isScanned ? const Color(0xFFD97706) : theme.colorScheme.error,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            state.errorMessage ?? 'An error occurred while validating the file.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => notifier.pickAndProcessFile(),
            icon: const Icon(Icons.refresh),
            label: const Text('Select Another File'),
          ),
        ],
      );
    }

    // Default: Initial Pick Screen
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest.withAlpha(128),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.upload_file,
              size: 56,
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Select your CV from Device',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Supported format: PDF (.pdf)\nMaximum size: 10 MB',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          FilledButton.icon(
            onPressed: () => notifier.pickAndProcessFile(),
            icon: const Icon(Icons.folder_open),
            label: const Text('Browse Files'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            ),
          ),
        ],
      ),
    );
  }
}
