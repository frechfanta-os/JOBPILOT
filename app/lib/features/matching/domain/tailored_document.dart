enum DocumentType {
  cv,
  coverLetter;

  static DocumentType fromString(String val) {
    if (val.toUpperCase() == 'COVER_LETTER') return DocumentType.coverLetter;
    return DocumentType.cv;
  }

  String get code {
    return this == DocumentType.coverLetter ? 'COVER_LETTER' : 'CV';
  }

  String get displayName {
    return this == DocumentType.coverLetter ? 'Cover Letter' : 'Tailored CV';
  }
}

enum DocumentStatus {
  draft,
  reviewed,
  approved;

  static DocumentStatus fromString(String val) {
    switch (val.toUpperCase()) {
      case 'APPROVED':
        return DocumentStatus.approved;
      case 'REVIEWED':
        return DocumentStatus.reviewed;
      case 'DRAFT':
      default:
        return DocumentStatus.draft;
    }
  }

  String get code => name.toUpperCase();

  String get displayName {
    switch (this) {
      case DocumentStatus.approved:
        return 'Approved by You';
      case DocumentStatus.reviewed:
        return 'Reviewed Draft';
      case DocumentStatus.draft:
        return 'Initial Draft';
    }
  }
}

class TailoredDocument {
  final String id;
  final String userId;
  final String jobId;
  final DocumentType documentType;
  final String language; // en, fr, it
  final int versionNumber;
  final String title;
  final String contentMarkdown;
  final DocumentStatus status;
  final String generationModel;
  final String? generationNotes;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TailoredDocument({
    required this.id,
    required this.userId,
    required this.jobId,
    required this.documentType,
    required this.language,
    required this.versionNumber,
    required this.title,
    required this.contentMarkdown,
    required this.status,
    required this.generationModel,
    this.generationNotes,
    this.createdAt,
    this.updatedAt,
  });

  bool get isApproved => status == DocumentStatus.approved;

  TailoredDocument copyWith({
    String? id,
    String? userId,
    String? jobId,
    DocumentType? documentType,
    String? language,
    int? versionNumber,
    String? title,
    String? contentMarkdown,
    DocumentStatus? status,
    String? generationModel,
    String? generationNotes,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TailoredDocument(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      jobId: jobId ?? this.jobId,
      documentType: documentType ?? this.documentType,
      language: language ?? this.language,
      versionNumber: versionNumber ?? this.versionNumber,
      title: title ?? this.title,
      contentMarkdown: contentMarkdown ?? this.contentMarkdown,
      status: status ?? this.status,
      generationModel: generationModel ?? this.generationModel,
      generationNotes: generationNotes ?? this.generationNotes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory TailoredDocument.fromJson(Map<String, dynamic> json) {
    return TailoredDocument(
      id: json['id'] as String? ?? '',
      userId: json['user_id'] as String? ?? '',
      jobId: json['job_id'] as String? ?? '',
      documentType: DocumentType.fromString(json['document_type'] as String? ?? 'CV'),
      language: json['language'] as String? ?? 'en',
      versionNumber: (json['version_number'] as num?)?.toInt() ?? 1,
      title: json['title'] as String? ?? 'Tailored Document',
      contentMarkdown: json['content_markdown'] as String? ?? '',
      status: DocumentStatus.fromString(json['status'] as String? ?? 'DRAFT'),
      generationModel: json['generation_model'] as String? ?? 'deterministic-ats-template-v1',
      generationNotes: json['generation_notes'] as String?,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
      updatedAt: json['updated_at'] != null ? DateTime.tryParse(json['updated_at'] as String) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'job_id': jobId,
    'document_type': documentType.code,
    'language': language,
    'version_number': versionNumber,
    'title': title,
    'content_markdown': contentMarkdown,
    'status': status.code,
    'generation_model': generationModel,
    'generation_notes': generationNotes,
    'created_at': createdAt?.toIso8601String(),
    'updated_at': updatedAt?.toIso8601String(),
  };
}
