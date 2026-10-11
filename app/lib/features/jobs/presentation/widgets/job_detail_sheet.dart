import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../domain/job_listing.dart';

class JobDetailSheet extends StatelessWidget {
  final JobListing job;

  const JobDetailSheet({
    super.key,
    required this.job,
  });

  static Future<void> show(BuildContext context, JobListing job) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => JobDetailSheet(job: job),
    );
  }

  Future<void> _openJobUrl(BuildContext context) async {
    final uri = Uri.tryParse(job.primaryActionUrl);
    if (uri != null) {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open external URL: ${job.primaryActionUrl}')),
        );
      }
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid job URL format')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final salary = job.formattedSalary;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Grab handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: colorScheme.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title and Flag
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      job.title,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(job.countryFlag, style: const TextStyle(fontSize: 28)),
                ],
              ),
              const SizedBox(height: 6),

              // Company & Location
              Text(
                '${job.companyName} • ${job.formattedLocation}',
                style: theme.textTheme.titleMedium?.copyWith(
                  color: colorScheme.secondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),

              // Salary & Details Badges
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  if (job.isRemote)
                    Chip(
                      avatar: const Icon(Icons.wifi, size: 14, color: Colors.teal),
                      label: const Text('Remote Eligible'),
                      backgroundColor: Colors.teal.withValues(alpha: 0.08),
                    ),
                  if (salary != null)
                    Chip(
                      avatar: const Icon(Icons.payments_outlined, size: 14, color: Colors.green),
                      label: Text(salary),
                      backgroundColor: Colors.green.withValues(alpha: 0.08),
                    ),
                  Chip(
                    avatar: const Icon(Icons.schedule, size: 14),
                    label: Text(job.contractType.replaceAll('_', ' ')),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Source Attribution & Transparency Alert
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(8),
                  border: Border(
                    left: BorderSide(color: colorScheme.primary, width: 4),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.verified, size: 16, color: colorScheme.primary),
                        const SizedBox(width: 6),
                        Text(
                          'Verified Opportunity Source',
                          style: theme.textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: colorScheme.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Published via ${job.sourceAttribution}. JobPilot aggregates verified job advertisements without altering content.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              const Divider(height: 1),
              const SizedBox(height: 12),

              // Description section
              Text(
                'Job Description',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),

              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  child: Text(
                    job.descriptionRaw.isNotEmpty
                        ? job.descriptionRaw
                        : 'No full description provided by source. Tap the button below to view the full original listing.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      height: 1.5,
                      color: colorScheme.onSurface,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 12),
              // Action Button to apply / view original
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => _openJobUrl(context),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('View Original Posting on Official Site'),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
