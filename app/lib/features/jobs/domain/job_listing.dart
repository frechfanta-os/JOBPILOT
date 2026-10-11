class JobListing {
  final String id;
  final String sourceId;
  final String sourceProvider;
  final String sourceAttribution;
  final String title;
  final String companyName;
  final String country; // 'CA' | 'IT'
  final String city;
  final String provinceOrRegion;
  final bool isRemote;
  final String contractType;
  final int? salaryMin;
  final int? salaryMax;
  final String currency; // 'CAD' | 'EUR'
  final String descriptionRaw;
  final String? descriptionSummary;
  final List<String> requiredLanguages;
  final List<String> requiredSkills;
  final String sourceUrl;
  final String? applicationUrl;
  final String contentHash;
  final String status; // 'ACTIVE' | 'EXPIRED' | 'UNKNOWN'
  final DateTime? publishedAt;
  final DateTime retrievedAt;

  const JobListing({
    required this.id,
    required this.sourceId,
    required this.sourceProvider,
    required this.sourceAttribution,
    required this.title,
    required this.companyName,
    required this.country,
    required this.city,
    required this.provinceOrRegion,
    required this.isRemote,
    required this.contractType,
    this.salaryMin,
    this.salaryMax,
    required this.currency,
    required this.descriptionRaw,
    this.descriptionSummary,
    required this.requiredLanguages,
    required this.requiredSkills,
    required this.sourceUrl,
    this.applicationUrl,
    required this.contentHash,
    required this.status,
    this.publishedAt,
    required this.retrievedAt,
  });

  String get countryFlag {
    if (country == 'CA') return '🇨🇦';
    if (country == 'IT') return '🇮🇹';
    return '🌐';
  }

  String get formattedLocation {
    final loc = city.isNotEmpty ? city : provinceOrRegion;
    final flag = countryFlag;
    if (isRemote) {
      return loc.isNotEmpty && loc.toLowerCase() != 'remote'
          ? '$loc $flag (Remote)'
          : 'Remote $flag';
    }
    return loc.isNotEmpty ? '$loc $flag' : flag;
  }

  String? get formattedSalary {
    if (salaryMin == null && salaryMax == null) return null;
    final currSymbol = currency == 'EUR' ? '€' : '\$';
    if (salaryMin != null && salaryMax != null) {
      final minStr = salaryMin! >= 1000 ? '${(salaryMin! / 1000).toStringAsFixed(0)}k' : '$salaryMin';
      final maxStr = salaryMax! >= 1000 ? '${(salaryMax! / 1000).toStringAsFixed(0)}k' : '$salaryMax';
      return '$currSymbol$minStr - $currSymbol$maxStr $currency';
    } else if (salaryMin != null) {
      final minStr = salaryMin! >= 1000 ? '${(salaryMin! / 1000).toStringAsFixed(0)}k' : '$salaryMin';
      return 'from $currSymbol$minStr $currency';
    }
    return null;
  }

  String get primaryActionUrl => applicationUrl ?? sourceUrl;

  factory JobListing.fromJson(Map<String, dynamic> json) {
    return JobListing(
      id: json['id'] as String? ?? '',
      sourceId: json['source_id'] as String? ?? '',
      sourceProvider: json['source_provider'] as String? ?? '',
      sourceAttribution: json['source_attribution'] as String? ?? json['source_provider'] as String? ?? '',
      title: json['title'] as String? ?? 'Untitled Opportunity',
      companyName: json['company_name'] as String? ?? 'Organization',
      country: json['country'] as String? ?? 'CA',
      city: json['city'] as String? ?? '',
      provinceOrRegion: json['province_or_region'] as String? ?? '',
      isRemote: json['is_remote'] == true || json['is_remote'] == 1,
      contractType: json['contract_type'] as String? ?? 'FULL_TIME',
      salaryMin: json['salary_min'] as int?,
      salaryMax: json['salary_max'] as int?,
      currency: json['currency'] as String? ?? 'CAD',
      descriptionRaw: json['description_raw'] as String? ?? '',
      descriptionSummary: json['description_summary'] as String?,
      requiredLanguages: (json['required_languages'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      requiredSkills: (json['required_skills'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      sourceUrl: json['source_url'] as String? ?? '',
      applicationUrl: json['application_url'] as String?,
      contentHash: json['content_hash'] as String? ?? '',
      status: json['status'] as String? ?? 'ACTIVE',
      publishedAt: json['published_at'] != null ? DateTime.tryParse(json['published_at'] as String) : null,
      retrievedAt: json['retrieved_at'] != null ? DateTime.tryParse(json['retrieved_at'] as String) ?? DateTime.now() : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'source_id': sourceId,
    'source_provider': sourceProvider,
    'source_attribution': sourceAttribution,
    'title': title,
    'company_name': companyName,
    'country': country,
    'city': city,
    'province_or_region': provinceOrRegion,
    'is_remote': isRemote,
    'contract_type': contractType,
    'salary_min': salaryMin,
    'salary_max': salaryMax,
    'currency': currency,
    'description_raw': descriptionRaw,
    'description_summary': descriptionSummary,
    'required_languages': requiredLanguages,
    'required_skills': requiredSkills,
    'source_url': sourceUrl,
    'application_url': applicationUrl,
    'content_hash': contentHash,
    'status': status,
    'published_at': publishedAt?.toIso8601String(),
    'retrieved_at': retrievedAt.toIso8601String(),
  };
}

class JobProviderStatusModel {
  final String name;
  final String coverage;
  final String status;
  final String? reason;

  const JobProviderStatusModel({
    required this.name,
    required this.coverage,
    required this.status,
    this.reason,
  });

  bool get isActive => status == 'ACTIVE';
  bool get isBlocked => status == 'BLOCKED';

  factory JobProviderStatusModel.fromJson(Map<String, dynamic> json) {
    return JobProviderStatusModel(
      name: json['name'] as String? ?? '',
      coverage: json['coverage'] as String? ?? '',
      status: json['status'] as String? ?? 'UNKNOWN',
      reason: json['reason'] as String?,
    );
  }
}

class JobDiscoveryResult {
  final List<JobListing> items;
  final int total;
  final int page;
  final int limit;
  final bool hasMore;
  final List<JobProviderStatusModel> sourceProviders;

  const JobDiscoveryResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.hasMore,
    required this.sourceProviders,
  });

  factory JobDiscoveryResult.fromJson(Map<String, dynamic> json) {
    final itemsList = (json['items'] as List<dynamic>?)
            ?.map((e) => JobListing.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final providersList = (json['source_providers'] as List<dynamic>?)
            ?.map((e) => JobProviderStatusModel.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return JobDiscoveryResult(
      items: itemsList,
      total: json['total'] as int? ?? itemsList.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      hasMore: json['has_more'] as bool? ?? false,
      sourceProviders: providersList,
    );
  }
}
