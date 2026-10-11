import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../domain/structured_profile.dart';
import '../controllers/cv_profile_controller.dart';

class ProfileReviewScreen extends ConsumerStatefulWidget {
  const ProfileReviewScreen({super.key});

  @override
  ConsumerState<ProfileReviewScreen> createState() => _ProfileReviewScreenState();
}

class _ProfileReviewScreenState extends ConsumerState<ProfileReviewScreen> {
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _headlineController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _locationController;

  @override
  void initState() {
    super.initState();
    final profile = ref.read(cvProfileProvider).profile ?? const UserProfile(id: 'usr_init', email: '');
    _firstNameController = TextEditingController(text: profile.firstName);
    _lastNameController = TextEditingController(text: profile.lastName);
    _headlineController = TextEditingController(text: profile.headline);
    _emailController = TextEditingController(text: profile.email);
    _phoneController = TextEditingController(text: profile.phoneNumber);
    _locationController = TextEditingController(text: profile.location);
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _headlineController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  void _syncPersonalDetails() {
    final current = ref.read(cvProfileProvider).profile;
    if (current == null) return;

    final updated = current.copyWith(
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      headline: _headlineController.text.trim(),
      email: _emailController.text.trim(),
      phoneNumber: _phoneController.text.trim(),
      location: _locationController.text.trim(),
    );
    ref.read(cvProfileProvider.notifier).updateProfile(updated);
  }

  Future<void> _handleConfirm() async {
    _syncPersonalDetails();
    await ref.read(cvProfileProvider.notifier).confirmAndSaveProfile();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Profile successfully verified and saved!'),
        backgroundColor: Color(0xFF15803D),
      ),
    );
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(cvProfileProvider);
    final profile = state.profile;
    final theme = Theme.of(context);

    if (profile == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Review Profile')),
        body: const Center(child: Text('No profile data available for review.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Extracted Profile'),
        actions: [
          TextButton.icon(
            onPressed: _handleConfirm,
            icon: const Icon(Icons.check),
            label: const Text('Confirm'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // Missing or Ambiguous Warnings Banner
          if (profile.missingFields.isNotEmpty || profile.lowConfidenceFields.isNotEmpty) ...[
            Card(
              color: const Color(0xFFFFFBEB),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Color(0xFFFDE68A)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.info_outline, color: Color(0xFFD97706), size: 18),
                        SizedBox(width: 8),
                        Text(
                          'Items Requiring Review',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'The following fields were missing or had low confidence in the source text: ${[
                        ...profile.missingFields,
                        ...profile.lowConfidenceFields
                      ].join(', ')}. Please verify or complete them.',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // 1. Personal & Contact Details Section
          _buildSectionHeader(context, 'Personal Details', Icons.person_outline),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _firstNameController,
                          decoration: const InputDecoration(labelText: 'First Name'),
                          onChanged: (_) => _syncPersonalDetails(),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _lastNameController,
                          decoration: const InputDecoration(labelText: 'Last Name'),
                          onChanged: (_) => _syncPersonalDetails(),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _headlineController,
                    decoration: const InputDecoration(
                      labelText: 'Professional Headline',
                      hintText: 'e.g., Senior Software Engineer',
                    ),
                    onChanged: (_) => _syncPersonalDetails(),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _emailController,
                          decoration: const InputDecoration(labelText: 'Email Address'),
                          onChanged: (_) => _syncPersonalDetails(),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _phoneController,
                          decoration: const InputDecoration(labelText: 'Phone Number'),
                          onChanged: (_) => _syncPersonalDetails(),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _locationController,
                    decoration: const InputDecoration(
                      labelText: 'Current Location / City',
                      hintText: 'e.g., Montreal, QC or Milan, Italy',
                    ),
                    onChanged: (_) => _syncPersonalDetails(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // 2. Work Experiences Section
          _buildSectionHeader(context, 'Work Experience (${profile.experiences.length})', Icons.work_outline),
          if (profile.experiences.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('No work experience automatically identified. You can add positions manually.'),
              ),
            )
          else
            ...profile.experiences.map((exp) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(exp.jobTitle, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${exp.companyName} • ${exp.startDate} - ${exp.endDate ?? "Present"}'),
                    trailing: Chip(
                      label: Text(exp.isExtracted ? 'Extracted' : 'Manual'),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                )),
          const SizedBox(height: 20),

          // 3. Education Section
          _buildSectionHeader(context, 'Education & Qualifications (${profile.education.length})', Icons.school_outlined),
          if (profile.education.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('No degrees automatically detected.'),
              ),
            )
          else
            ...profile.education.map((edu) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(edu.degreeName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${edu.institution} • ${edu.graduationYear ?? "N/A"}'),
                    trailing: Chip(
                      label: Text(edu.isExtracted ? 'Extracted' : 'Manual'),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                )),
          const SizedBox(height: 20),

          // 4. Skills Section
          _buildSectionHeader(context, 'Skills & Competencies (${profile.skills.length})', Icons.code),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: profile.skills.isEmpty
                  ? const Text('No technical skills identified in CV text.')
                  : Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: profile.skills
                          .map((sk) => Chip(
                                label: Text(sk.name),
                                avatar: const Icon(Icons.check, size: 14),
                              ))
                          .toList(),
                    ),
            ),
          ),
          const SizedBox(height: 20),

          // 5. Languages Section
          _buildSectionHeader(context, 'Languages (${profile.languages.length})', Icons.language),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: profile.languages.isEmpty
                  ? const Text('No languages detected.')
                  : Column(
                      children: profile.languages
                          .map((lang) => ListTile(
                                leading: const Icon(Icons.translate),
                                title: Text(lang.name),
                                trailing: Text(
                                  lang.proficiency,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: theme.colorScheme.primary,
                                  ),
                                ),
                              ))
                          .toList(),
                    ),
            ),
          ),
          const SizedBox(height: 32),

          // Bottom Action
          FilledButton.icon(
            onPressed: _handleConfirm,
            icon: const Icon(Icons.check_circle_outline),
            label: const Text('Confirm & Save Verified Profile'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title, IconData icon) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
