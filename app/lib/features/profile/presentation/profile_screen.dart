import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'controllers/cv_profile_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(cvProfileProvider);
    final profile = state.profile;
    final theme = Theme.of(context);
    final isConfirmed = profile?.isConfirmedByUser ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Candidate Profile & CV'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // Candidate Identity Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: isConfirmed
                        ? const Color(0xFF15803D).withAlpha(38)
                        : theme.colorScheme.primaryContainer,
                    child: Icon(
                      isConfirmed ? Icons.verified_user : Icons.person,
                      size: 36,
                      color: isConfirmed
                          ? const Color(0xFF15803D)
                          : theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isConfirmed && profile!.fullName.isNotEmpty
                              ? profile.fullName
                              : 'Candidate Profile',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isConfirmed && profile!.headline.isNotEmpty
                              ? profile.headline
                              : 'Import your CV to extract and structure qualifications',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        if (isConfirmed) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF15803D).withAlpha(25),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'Verified & Active',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF15803D),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // CV Management Section
          Text(
            'Master CV Document',
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: Icon(
                state.selectedFile != null ? Icons.description : Icons.upload_file,
                color: theme.colorScheme.primary,
              ),
              title: Text(
                state.selectedFile != null
                    ? state.selectedFile!.filename
                    : 'Import CV (PDF)',
              ),
              subtitle: Text(
                state.selectedFile != null
                    ? 'Size: ${state.selectedFile!.formattedSize} • SHA: ${state.selectedFile!.sha256Checksum.substring(0, 8)}...'
                    : 'Upload PDF CV to automatically extract structured profile',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/cv-import'),
            ),
          ),
          if (profile != null) ...[
            const SizedBox(height: 8),
            Card(
              child: ListTile(
                leading: const Icon(Icons.edit_note),
                title: const Text('Review & Edit Profile Fields'),
                subtitle: Text(
                  '${profile.experiences.length} experience(s), ${profile.education.length} degree(s), ${profile.skills.length} skill(s)',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/profile-review'),
              ),
            ),
          ],
          const SizedBox(height: 16),

          // Target Market Authorization
          Text(
            'Target Markets & Work Authorization',
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Text('🇨🇦', style: TextStyle(fontSize: 24)),
                  title: const Text('Canada Status'),
                  subtitle: Text(profile?.workAuthorization.canadaStatus ?? 'UNKNOWN'),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Text('🇮🇹', style: TextStyle(fontSize: 24)),
                  title: const Text('Italy / EU Status'),
                  subtitle: Text(profile?.workAuthorization.italyStatus ?? 'UNKNOWN'),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
