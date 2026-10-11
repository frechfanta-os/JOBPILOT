import 'package:flutter/material.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

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
                    backgroundColor: theme.colorScheme.primaryContainer,
                    child: Icon(Icons.person, size: 36, color: theme.colorScheme.primary),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Candidate Profile',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Import your CV to auto-extract qualifications',
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // CV Management Section
          Text('CV Documents', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.upload_file),
              title: const Text('Import CV (PDF)'),
              subtitle: const Text('Upload your master CV to generate structured profile'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            ),
          ),
          const SizedBox(height: 16),

          // Market Authorization
          Text('Target Markets & Authorization', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Card(
            child: Column(
              children: [
                ListTile(
                  leading: Text('🇨🇦', style: TextStyle(fontSize: 24)),
                  title: Text('Canada Status'),
                  subtitle: Text('Not verified'),
                  trailing: Icon(Icons.arrow_forward_ios, size: 14),
                ),
                Divider(height: 1),
                ListTile(
                  leading: Text('🇮🇹', style: TextStyle(fontSize: 24)),
                  title: Text('Italy / EU Status'),
                  subtitle: Text('Not verified'),
                  trailing: Icon(Icons.arrow_forward_ios, size: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
