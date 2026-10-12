import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../jobs/domain/job_listing.dart';
import '../controllers/matching_controller.dart';
import '../../domain/tailored_document.dart';

class TailoredDocumentScreen extends ConsumerStatefulWidget {
  final JobListing job;

  const TailoredDocumentScreen({super.key, required this.job});

  @override
  ConsumerState<TailoredDocumentScreen> createState() => _TailoredDocumentScreenState();
}

class _TailoredDocumentScreenState extends ConsumerState<TailoredDocumentScreen> {
  DocumentType _selectedType = DocumentType.cv;
  String _selectedLanguage = 'en';
  bool _isEditing = false;
  late TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController();
    // Default language based on job country
    if (widget.job.country == 'IT') {
      _selectedLanguage = 'it';
    } else if (widget.job.requiredLanguages.contains('fr')) {
      _selectedLanguage = 'fr';
    }

    Future.microtask(() {
      ref.read(tailoredDocsProvider.notifier).loadDocuments(widget.job.id);
    });
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final docsState = ref.watch(tailoredDocsProvider);
    final jobDocs = docsState.getDocuments(widget.job.id);
    final isLoading = docsState.isLoading(widget.job.id);
    final isGenerating = docsState.isGenerating(widget.job.id);

    // Find active doc matching selected type and language if present
    final matchingDocs = jobDocs
        .where((d) => d.documentType == _selectedType && d.language == _selectedLanguage)
        .toList();
    final activeDoc = matchingDocs.isNotEmpty ? matchingDocs.first : null;

    if (activeDoc != null && !_isEditing && _textController.text != activeDoc.contentMarkdown) {
      _textController.text = activeDoc.contentMarkdown;
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Tailored Documents', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(
              '${widget.job.companyName} • ${widget.job.title}',
              style: theme.textTheme.bodySmall?.copyWith(fontSize: 12),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          if (activeDoc != null)
            IconButton(
              icon: const Icon(Icons.copy),
              tooltip: 'Copy to Clipboard',
              onPressed: () {
                Clipboard.setData(ClipboardData(text: _textController.text));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Document copied to clipboard')),
                );
              },
            ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Top Selector Bar: Type and Language
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
                  child: Row(
                    children: [
                      // Document Type Segmented Control
                      Expanded(
                        child: SegmentedButton<DocumentType>(
                          segments: const [
                            ButtonSegment(
                              value: DocumentType.cv,
                              label: Text('Tailored CV'),
                              icon: Icon(Icons.badge_outlined, size: 16),
                            ),
                            ButtonSegment(
                              value: DocumentType.coverLetter,
                              label: Text('Cover Letter'),
                              icon: Icon(Icons.mail_outline, size: 16),
                            ),
                          ],
                          selected: {_selectedType},
                          onSelectionChanged: (set) {
                            setState(() {
                              _selectedType = set.first;
                              _isEditing = false;
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Language Dropdown
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        decoration: BoxDecoration(
                          border: Border.all(color: colorScheme.outlineVariant),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: DropdownButton<String>(
                          value: _selectedLanguage,
                          underline: const SizedBox(),
                          items: const [
                            DropdownMenuItem(value: 'en', child: Text('🇺🇸 EN')),
                            DropdownMenuItem(value: 'fr', child: Text('🇫🇷 FR')),
                            DropdownMenuItem(value: 'it', child: Text('🇮🇹 IT')),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _selectedLanguage = val;
                                _isEditing = false;
                              });
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),

                // Grounding & Ethical AI Guarantee
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  color: Colors.teal.withValues(alpha: 0.08),
                  child: Row(
                    children: [
                      const Icon(Icons.verified_user_outlined, size: 16, color: Colors.teal),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Zero-hallucination guarantee: Content is strictly derived from your confirmed profile facts.',
                          style: theme.textTheme.bodySmall?.copyWith(color: Colors.teal.shade900, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),

                // Main Content View / Editor
                Expanded(
                  child: activeDoc == null
                      ? _buildEmptyGenerationView(context, isGenerating)
                      : _buildDocumentContentView(context, activeDoc),
                ),

                // Bottom Action Footer
                if (activeDoc != null) _buildFooterActions(context, activeDoc),
              ],
            ),
    );
  }

  Widget _buildEmptyGenerationView(BuildContext context, bool isGenerating) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _selectedType == DocumentType.cv ? Icons.description_outlined : Icons.mail_outline,
              size: 64,
              color: colorScheme.primary.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'No ${_selectedType.displayName} in ${_selectedLanguage.toUpperCase()} yet',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Generate an ATS-optimized ${_selectedType.displayName.toLowerCase()} tailored specifically to the requirements of ${widget.job.companyName}.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: isGenerating
                  ? null
                  : () {
                      ref.read(tailoredDocsProvider.notifier).generateDocument(
                            job: widget.job,
                            type: _selectedType,
                            language: _selectedLanguage,
                          );
                    },
              icon: isGenerating
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.auto_awesome),
              label: Text(isGenerating ? 'Generating...' : 'Generate Grounded ${_selectedType.displayName}'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDocumentContentView(BuildContext context, TailoredDocument doc) {
    final theme = Theme.of(context);

    return Column(
      children: [
        // Status & Metadata Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: Theme.of(context).colorScheme.outlineVariant)),
          ),
          child: Row(
            children: [
              _buildStatusBadge(doc.status),
              const SizedBox(width: 8),
              Text(
                'v${doc.versionNumber} • ${doc.generationModel}',
                style: theme.textTheme.bodySmall?.copyWith(fontSize: 11),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: () {
                  setState(() {
                    _isEditing = !_isEditing;
                  });
                },
                icon: Icon(_isEditing ? Icons.visibility : Icons.edit, size: 16),
                label: Text(_isEditing ? 'Preview' : 'Edit Text'),
              ),
            ],
          ),
        ),

        // Document Body
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: _isEditing
                ? TextField(
                    controller: _textController,
                    maxLines: null,
                    expands: true,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: 'Edit document text...',
                    ),
                  )
                : SingleChildScrollView(
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
                      ),
                      child: SelectableText(
                        _textController.text,
                        style: const TextStyle(fontSize: 14, height: 1.5),
                      ),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(DocumentStatus status) {
    Color bg = Colors.blue.withValues(alpha: 0.15);
    Color fg = Colors.blue.shade800;
    String label = 'Draft';

    switch (status) {
      case DocumentStatus.approved:
        bg = Colors.green.withValues(alpha: 0.15);
        fg = Colors.green.shade800;
        label = '✓ Approved by Candidate';
        break;
      case DocumentStatus.reviewed:
        bg = Colors.orange.withValues(alpha: 0.15);
        fg = Colors.orange.shade800;
        label = 'Reviewed Draft';
        break;
      case DocumentStatus.draft:
        bg = Colors.blue.withValues(alpha: 0.15);
        fg = Colors.blue.shade800;
        label = 'Initial Draft';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.bold, fontSize: 11)),
    );
  }

  Widget _buildFooterActions(BuildContext context, TailoredDocument doc) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, -2)),
        ],
      ),
      child: Row(
        children: [
          if (_isEditing)
            Expanded(
              child: FilledButton.tonalIcon(
                onPressed: () async {
                  final ok = await ref
                      .read(tailoredDocsProvider.notifier)
                      .updateDocumentContent(
                        jobId: widget.job.id,
                        docId: doc.id,
                        newMarkdown: _textController.text,
                      );
                  if (ok && context.mounted) {
                    setState(() => _isEditing = false);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Changes saved as reviewed draft.')),
                    );
                  }
                },
                icon: const Icon(Icons.save),
                label: const Text('Save Draft'),
              ),
            )
          else ...[
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {
                  ref.read(tailoredDocsProvider.notifier).generateDocument(
                        job: widget.job,
                        type: _selectedType,
                        language: _selectedLanguage,
                      );
                },
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Regenerate (v+)'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: doc.isApproved ? Colors.green.shade700 : null,
                ),
                onPressed: doc.isApproved ? null : () => _confirmApproval(context, doc),
                icon: Icon(doc.isApproved ? Icons.check_circle : Icons.approval, size: 18),
                label: Text(doc.isApproved ? 'Approved' : 'Approve Document'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _confirmApproval(BuildContext context, TailoredDocument doc) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve Application Document?'),
        content: Text(
          'By approving this ${doc.documentType.displayName}, you confirm that all statements, dates, and qualifications accurately reflect your background. JobPilot will never submit applications automatically without your authorization.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final ok = await ref
                  .read(tailoredDocsProvider.notifier)
                  .approveDocument(
                    jobId: widget.job.id,
                    docId: doc.id,
                  );
              if (ok && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Document approved successfully.')),
                );
              }
            },
            child: const Text('Confirm & Approve'),
          ),
        ],
      ),
    );
  }
}
