import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../jobs/domain/job_listing.dart';
import '../controllers/matching_controller.dart';
import '../../domain/match_assessment.dart';
import '../screens/tailored_document_screen.dart';

class MatchScoreCard extends ConsumerWidget {
  final JobListing job;

  const MatchScoreCard({super.key, required this.job});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final matchingState = ref.watch(jobMatchingProvider);
    final isLoading = matchingState.isJobLoading(job.id);
    final assessment = matchingState.getAssessment(job.id);

    if (isLoading) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
            SizedBox(width: 16),
            Expanded(
              child: Text(
                'Assessing match with confirmed CV profile...',
                style: TextStyle(fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      );
    }

    if (assessment == null) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colorScheme.primaryContainer.withValues(alpha: 0.25),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.primary.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(Icons.auto_awesome, color: colorScheme.primary, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Profile Compatibility',
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'Evaluate fit against your confirmed CV credentials.',
                    style: theme.textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            FilledButton.tonal(
              onPressed: () => ref.read(jobMatchingProvider.notifier).assessMatch(job),
              child: const Text('Check Fit'),
            ),
          ],
        ),
      );
    }

    final scoreColor = assessment.isHighMatch
        ? Colors.teal
        : assessment.isModerateMatch
            ? Colors.indigo
            : Colors.amber.shade800;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: scoreColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Overall Score & Authorization Badge
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: scoreColor.withValues(alpha: 0.15),
                  border: Border.all(color: scoreColor, width: 2.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${assessment.overallScore}%',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: scoreColor,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Overall Fit',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          assessment.isHighMatch
                              ? 'Strong Candidate'
                              : assessment.isModerateMatch
                                  ? 'Good Alignment'
                                  : 'Potential Gaps',
                          style: theme.textTheme.labelMedium?.copyWith(color: scoreColor),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    _buildAuthorizationChip(assessment.authorizationCompatibility),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Criteria breakdown progress bars
          _buildScoreBar('Skills (40%)', assessment.skillsScore, scoreColor, theme),
          const SizedBox(height: 6),
          _buildScoreBar('Experience (25%)', assessment.experienceScore, scoreColor, theme),
          const SizedBox(height: 6),
          _buildScoreBar('Education (15%)', assessment.educationScore, scoreColor, theme),
          const SizedBox(height: 6),
          _buildScoreBar('Language (10%)', assessment.languageScore, scoreColor, theme),
          const SizedBox(height: 6),
          _buildScoreBar('Location (10%)', assessment.locationScore, scoreColor, theme),

          const SizedBox(height: 12),

          // Matched & Missing Skills
          if (assessment.matchedSkills.isNotEmpty) ...[
            Text('Matched Skills', style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: assessment.matchedSkills
                  .map((s) => Chip(
                        avatar: const Icon(Icons.check_circle, size: 14, color: Colors.teal),
                        label: Text(s, style: const TextStyle(fontSize: 12)),
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        backgroundColor: Colors.teal.withValues(alpha: 0.08),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 8),
          ],

          if (assessment.missingSkills.isNotEmpty) ...[
            Text('Skills to Emphasize / Gaps', style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: assessment.missingSkills
                  .map((s) => Chip(
                        avatar: const Icon(Icons.info_outline, size: 14, color: Colors.amber),
                        label: Text(s, style: const TextStyle(fontSize: 12)),
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        backgroundColor: Colors.amber.withValues(alpha: 0.1),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 10),
          ],

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showBreakdownDialog(context, assessment),
                  icon: const Icon(Icons.analytics_outlined, size: 18),
                  label: const Text('Breakdown'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => TailoredDocumentScreen(job: job),
                      ),
                    );
                  },
                  icon: const Icon(Icons.description, size: 18),
                  label: const Text('Tailored Docs'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAuthorizationChip(AuthorizationCompatibility compat) {
    Color bg = Colors.grey.withValues(alpha: 0.12);
    Color fg = Colors.grey.shade800;
    IconData icon = Icons.help_outline;
    String text = 'Unknown';

    switch (compat) {
      case AuthorizationCompatibility.eligible:
        bg = Colors.green.withValues(alpha: 0.12);
        fg = Colors.green.shade800;
        icon = Icons.check_circle;
        text = 'Eligible to Work';
        break;
      case AuthorizationCompatibility.needsSponsorship:
        bg = Colors.orange.withValues(alpha: 0.12);
        fg = Colors.orange.shade900;
        icon = Icons.warning_amber_rounded;
        text = 'Sponsorship Required';
        break;
      case AuthorizationCompatibility.unverifiedOrUnknown:
        bg = Colors.amber.withValues(alpha: 0.12);
        fg = Colors.amber.shade900;
        icon = Icons.help_outline;
        text = 'Work Authorization Unverified';
        break;
      case AuthorizationCompatibility.ineligible:
        bg = Colors.red.withValues(alpha: 0.12);
        fg = Colors.red.shade900;
        icon = Icons.cancel;
        text = 'Ineligible';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: fg),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
        ],
      ),
    );
  }

  Widget _buildScoreBar(String label, int score, Color color, ThemeData theme) {
    return Row(
      children: [
        SizedBox(
          width: 120,
          child: Text(label, style: theme.textTheme.bodySmall?.copyWith(fontSize: 11)),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (score / 100).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: theme.colorScheme.outlineVariant.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 32,
          child: Text('$score%', style: theme.textTheme.bodySmall?.copyWith(fontSize: 11, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  void _showBreakdownDialog(BuildContext context, MatchAssessment assessment) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          expand: false,
          builder: (_, scrollCtrl) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ListView(
                controller: scrollCtrl,
                children: [
                  Text('Detailed Compatibility Analysis', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(
                    'Scored with ${assessment.scoringVersion} based strictly on your confirmed CV facts.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const Divider(height: 24),

                  // Evidence
                  if (assessment.matchingEvidence.isNotEmpty) ...[
                    Text('Grounded Alignment Evidence', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...assessment.matchingEvidence.map((ev) => ListTile(
                          dense: true,
                          leading: const Icon(Icons.check_circle_outline, color: Colors.teal),
                          title: Text(ev.qualification, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(ev.evidence),
                        )),
                    const Divider(height: 24),
                  ],

                  // Risks
                  if (assessment.riskFactors.isNotEmpty) ...[
                    Text('Identified Risks & Disclaimers', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...assessment.riskFactors.map((rf) => ListTile(
                          dense: true,
                          leading: const Icon(Icons.warning_amber, color: Colors.orange),
                          title: Text(rf),
                        )),
                    const Divider(height: 24),
                  ],

                  // Actions
                  if (assessment.recommendedActions.isNotEmpty) ...[
                    Text('Recommended Actions', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...assessment.recommendedActions.map((act) => ListTile(
                          dense: true,
                          leading: const Icon(Icons.lightbulb_outline, color: Colors.indigo),
                          title: Text(act),
                        )),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }
}
