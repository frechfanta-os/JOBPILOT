/// Represents a structured, editable candidate profile in JobPilot International.
class UserProfile {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String phoneNumber;
  final String location;
  final String headline;
  final String summary;
  final List<String> targetCountries;
  final String primaryLanguage;
  final WorkAuthorization workAuthorization;
  final List<WorkExperience> experiences;
  final List<EducationItem> education;
  final List<SkillItem> skills;
  final List<LanguageItem> languages;
  final List<CertificationItem> certifications;
  final List<String> missingFields;
  final List<String> lowConfidenceFields;
  final String? cvDocumentId;
  final String? rawCvText;
  final bool isConfirmedByUser;
  final DateTime? updatedAt;

  const UserProfile({
    required this.id,
    required this.email,
    this.firstName = '',
    this.lastName = '',
    this.phoneNumber = '',
    this.location = '',
    this.headline = '',
    this.summary = '',
    this.targetCountries = const ['CA', 'IT'],
    this.primaryLanguage = 'en',
    this.workAuthorization = const WorkAuthorization(),
    this.experiences = const [],
    this.education = const [],
    this.skills = const [],
    this.languages = const [],
    this.certifications = const [],
    this.missingFields = const [],
    this.lowConfidenceFields = const [],
    this.cvDocumentId,
    this.rawCvText,
    this.isConfirmedByUser = false,
    this.updatedAt,
  });

  String get fullName {
    final combined = '$firstName $lastName'.trim();
    return combined.isEmpty ? 'Anonymous Candidate' : combined;
  }

  UserProfile copyWith({
    String? id,
    String? email,
    String? firstName,
    String? lastName,
    String? phoneNumber,
    String? location,
    String? headline,
    String? summary,
    List<String>? targetCountries,
    String? primaryLanguage,
    WorkAuthorization? workAuthorization,
    List<WorkExperience>? experiences,
    List<EducationItem>? education,
    List<SkillItem>? skills,
    List<LanguageItem>? languages,
    List<CertificationItem>? certifications,
    List<String>? missingFields,
    List<String>? lowConfidenceFields,
    String? cvDocumentId,
    String? rawCvText,
    bool? isConfirmedByUser,
    DateTime? updatedAt,
  }) {
    return UserProfile(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      location: location ?? this.location,
      headline: headline ?? this.headline,
      summary: summary ?? this.summary,
      targetCountries: targetCountries ?? this.targetCountries,
      primaryLanguage: primaryLanguage ?? this.primaryLanguage,
      workAuthorization: workAuthorization ?? this.workAuthorization,
      experiences: experiences ?? this.experiences,
      education: education ?? this.education,
      skills: skills ?? this.skills,
      languages: languages ?? this.languages,
      certifications: certifications ?? this.certifications,
      missingFields: missingFields ?? this.missingFields,
      lowConfidenceFields: lowConfidenceFields ?? this.lowConfidenceFields,
      cvDocumentId: cvDocumentId ?? this.cvDocumentId,
      rawCvText: rawCvText ?? this.rawCvText,
      isConfirmedByUser: isConfirmedByUser ?? this.isConfirmedByUser,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'phone_number': phoneNumber,
      'location': location,
      'headline': headline,
      'summary': summary,
      'target_countries': targetCountries,
      'primary_language': primaryLanguage,
      'work_authorization': workAuthorization.toJson(),
      'experiences': experiences.map((e) => e.toJson()).toList(),
      'education': education.map((e) => e.toJson()).toList(),
      'skills': skills.map((e) => e.toJson()).toList(),
      'languages': languages.map((e) => e.toJson()).toList(),
      'certifications': certifications.map((e) => e.toJson()).toList(),
      'missing_fields': missingFields,
      'low_confidence_fields': lowConfidenceFields,
      'cv_document_id': cvDocumentId,
      'is_confirmed_by_user': isConfirmedByUser,
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String? ?? 'usr_default',
      email: json['email'] as String? ?? '',
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      location: json['location'] as String? ?? '',
      headline: json['headline'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      targetCountries: (json['target_countries'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const ['CA', 'IT'],
      primaryLanguage: json['primary_language'] as String? ?? 'en',
      workAuthorization: json['work_authorization'] != null
          ? WorkAuthorization.fromJson(
              json['work_authorization'] as Map<String, dynamic>)
          : const WorkAuthorization(),
      experiences: (json['experiences'] as List<dynamic>?)
              ?.map((e) => WorkExperience.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      education: (json['education'] as List<dynamic>?)
              ?.map((e) => EducationItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      skills: (json['skills'] as List<dynamic>?)
              ?.map((e) => SkillItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      languages: (json['languages'] as List<dynamic>?)
              ?.map((e) => LanguageItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      certifications: (json['certifications'] as List<dynamic>?)
              ?.map((e) => CertificationItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      missingFields: (json['missing_fields'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      lowConfidenceFields: (json['low_confidence_fields'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      cvDocumentId: json['cv_document_id'] as String?,
      rawCvText: json['raw_cv_text'] as String?,
      isConfirmedByUser: json['is_confirmed_by_user'] as bool? ?? false,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
    );
  }
}

class WorkAuthorization {
  final String canadaStatus;
  final String italyStatus;
  final bool verifiedByUser;

  const WorkAuthorization({
    this.canadaStatus = 'UNKNOWN',
    this.italyStatus = 'UNKNOWN',
    this.verifiedByUser = false,
  });

  Map<String, dynamic> toJson() => {
        'canada_status': canadaStatus,
        'italy_status': italyStatus,
        'verified_by_user': verifiedByUser,
      };

  factory WorkAuthorization.fromJson(Map<String, dynamic> json) =>
      WorkAuthorization(
        canadaStatus: json['canada_status'] as String? ?? 'UNKNOWN',
        italyStatus: json['italy_status'] as String? ?? 'UNKNOWN',
        verifiedByUser: json['verified_by_user'] as bool? ?? false,
      );
}

class WorkExperience {
  final String id;
  final String companyName;
  final String jobTitle;
  final String location;
  final String startDate; // YYYY-MM
  final String? endDate;   // YYYY-MM or null
  final bool isCurrent;
  final String description;
  final List<String> technologies;
  final bool isExtracted;
  final bool isConfirmed;

  const WorkExperience({
    required this.id,
    required this.companyName,
    required this.jobTitle,
    this.location = '',
    required this.startDate,
    this.endDate,
    this.isCurrent = false,
    this.description = '',
    this.technologies = const [],
    this.isExtracted = true,
    this.isConfirmed = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'company_name': companyName,
        'job_title': jobTitle,
        'location': location,
        'start_date': startDate,
        'end_date': endDate,
        'is_current': isCurrent,
        'description': description,
        'technologies': technologies,
        'is_extracted': isExtracted,
        'is_confirmed': isConfirmed,
      };

  factory WorkExperience.fromJson(Map<String, dynamic> json) => WorkExperience(
        id: json['id'] as String? ?? '',
        companyName: json['company_name'] as String? ?? '',
        jobTitle: json['job_title'] as String? ?? '',
        location: json['location'] as String? ?? '',
        startDate: json['start_date'] as String? ?? '',
        endDate: json['end_date'] as String?,
        isCurrent: json['is_current'] as bool? ?? false,
        description: json['description'] as String? ?? '',
        technologies: (json['technologies'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        isExtracted: json['is_extracted'] as bool? ?? true,
        isConfirmed: json['is_confirmed'] as bool? ?? false,
      );
}

class EducationItem {
  final String id;
  final String institution;
  final String degreeName;
  final String fieldOfStudy;
  final int? graduationYear;
  final bool isExtracted;
  final bool isConfirmed;

  const EducationItem({
    required this.id,
    required this.institution,
    required this.degreeName,
    this.fieldOfStudy = '',
    this.graduationYear,
    this.isExtracted = true,
    this.isConfirmed = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'institution': institution,
        'degree_name': degreeName,
        'field_of_study': fieldOfStudy,
        'graduation_year': graduationYear,
        'is_extracted': isExtracted,
        'is_confirmed': isConfirmed,
      };

  factory EducationItem.fromJson(Map<String, dynamic> json) => EducationItem(
        id: json['id'] as String? ?? '',
        institution: json['institution'] as String? ?? '',
        degreeName: json['degree_name'] as String? ?? '',
        fieldOfStudy: json['field_of_study'] as String? ?? '',
        graduationYear: json['graduation_year'] as int?,
        isExtracted: json['is_extracted'] as bool? ?? true,
        isConfirmed: json['is_confirmed'] as bool? ?? false,
      );
}

class SkillItem {
  final String id;
  final String name;
  final String level; // BEGINNER | INTERMEDIATE | ADVANCED | EXPERT
  final int yearsOfExperience;
  final bool isExtracted;
  final bool isConfirmed;

  const SkillItem({
    required this.id,
    required this.name,
    this.level = 'INTERMEDIATE',
    this.yearsOfExperience = 1,
    this.isExtracted = true,
    this.isConfirmed = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'level': level,
        'years_of_experience': yearsOfExperience,
        'is_extracted': isExtracted,
        'is_confirmed': isConfirmed,
      };

  factory SkillItem.fromJson(Map<String, dynamic> json) => SkillItem(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        level: json['level'] as String? ?? 'INTERMEDIATE',
        yearsOfExperience: json['years_of_experience'] as int? ?? 1,
        isExtracted: json['is_extracted'] as bool? ?? true,
        isConfirmed: json['is_confirmed'] as bool? ?? false,
      );
}

class LanguageItem {
  final String code; // en | fr | it
  final String name;
  final String proficiency; // BASIC | CONVERSATIONAL | PROFESSIONAL | NATIVE
  final bool isExtracted;
  final bool isConfirmed;

  const LanguageItem({
    required this.code,
    required this.name,
    this.proficiency = 'PROFESSIONAL',
    this.isExtracted = true,
    this.isConfirmed = false,
  });

  Map<String, dynamic> toJson() => {
        'code': code,
        'name': name,
        'proficiency': proficiency,
        'is_extracted': isExtracted,
        'is_confirmed': isConfirmed,
      };

  factory LanguageItem.fromJson(Map<String, dynamic> json) => LanguageItem(
        code: json['code'] as String? ?? 'en',
        name: json['name'] as String? ?? 'English',
        proficiency: json['proficiency'] as String? ?? 'PROFESSIONAL',
        isExtracted: json['is_extracted'] as bool? ?? true,
        isConfirmed: json['is_confirmed'] as bool? ?? false,
      );
}

class CertificationItem {
  final String name;
  final String issuer;
  final int? year;
  final bool isExtracted;
  final bool isConfirmed;

  const CertificationItem({
    required this.name,
    required this.issuer,
    this.year,
    this.isExtracted = true,
    this.isConfirmed = false,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'issuer': issuer,
        'year': year,
        'is_extracted': isExtracted,
        'is_confirmed': isConfirmed,
      };

  factory CertificationItem.fromJson(Map<String, dynamic> json) =>
      CertificationItem(
        name: json['name'] as String? ?? '',
        issuer: json['issuer'] as String? ?? '',
        year: json['year'] as int?,
        isExtracted: json['is_extracted'] as bool? ?? true,
        isConfirmed: json['is_confirmed'] as bool? ?? false,
      );
}
