import 'package:flutter/material.dart';
import '../../../core/widgets/state_views.dart';

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  String _selectedCountry = 'ALL';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Job Discovery'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
            tooltip: 'Filter',
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Row(
              children: [
                FilterChip(
                  label: const Text('All Countries'),
                  selected: _selectedCountry == 'ALL',
                  onSelected: (val) => setState(() => _selectedCountry = 'ALL'),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Canada 🇨🇦'),
                  selected: _selectedCountry == 'CA',
                  onSelected: (val) => setState(() => _selectedCountry = 'CA'),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Italy 🇮🇹'),
                  selected: _selectedCountry == 'IT',
                  onSelected: (val) => setState(() => _selectedCountry = 'IT'),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Job Listings State
          const Expanded(
            child: EmptyStateView(
              icon: Icons.work_outline,
              title: 'No Job Offers Loaded',
              message: 'Connect job search feeds in Phase 3 to discover matching opportunities in Canada and Italy.',
            ),
          ),
        ],
      ),
    );
  }
}
