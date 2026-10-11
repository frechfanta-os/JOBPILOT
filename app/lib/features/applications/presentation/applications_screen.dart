import 'package:flutter/material.dart';
import '../../../core/widgets/state_views.dart';

class ApplicationsScreen extends StatelessWidget {
  const ApplicationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Applications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sort),
            onPressed: () {},
            tooltip: 'Sort Applications',
          ),
        ],
      ),
      body: const EmptyStateView(
        icon: Icons.assignment_outlined,
        title: 'No Applications in Pipeline',
        message: 'Applications you prepare and approve will be tracked across their lifecycle here.',
      ),
    );
  }
}
