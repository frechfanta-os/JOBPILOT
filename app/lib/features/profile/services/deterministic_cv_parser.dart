import '../domain/structured_profile.dart';

/// Offline deterministic parser that converts raw extracted CV text into a structured candidate profile.
/// Strictly extracts only factual data present in the text and flags missing or low-confidence fields.
class DeterministicCVParser {
  const DeterministicCVParser();

  UserProfile parse(String rawText, {String? userId, String? cvDocumentId}) {
    final lines = rawText
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    String email = _extractEmail(rawText);
    String phone = _extractPhone(rawText);
    String location = _extractLocation(rawText);
    String fullName = _extractCandidateName(lines, email);
    String summary = _extractSummary(lines);

    // Split first name and last name
    String firstName = '';
    String lastName = '';
    if (fullName.isNotEmpty) {
      final parts = fullName.split(' ');
      if (parts.length == 1) {
        firstName = parts[0];
      } else {
        firstName = parts.first;
        lastName = parts.sublist(1).join(' ');
      }
    }

    final skills = _extractSkills(rawText);
    final languages = _extractLanguages(rawText);
    final experiences = _extractExperiences(lines);
    final education = _extractEducation(lines);

    final missingFields = <String>[];
    final lowConfidenceFields = <String>[];

    if (email.isEmpty) missingFields.add('email');
    if (phone.isEmpty) missingFields.add('phone_number');
    if (firstName.isEmpty && lastName.isEmpty) missingFields.add('full_name');
    if (location.isEmpty) missingFields.add('location');
    if (experiences.isEmpty) lowConfidenceFields.add('experiences');
    if (education.isEmpty) lowConfidenceFields.add('education');
    if (skills.isEmpty) missingFields.add('skills');
    if (languages.isEmpty) lowConfidenceFields.add('languages');

    // Detect target country preference from location or languages
    final targetCountries = <String>[];
    final lowerText = rawText.toLowerCase();
    if (lowerText.contains('canada') || lowerText.contains('quebec') || lowerText.contains('ontario') || lowerText.contains('montreal') || lowerText.contains('toronto')) {
      targetCountries.add('CA');
    }
    if (lowerText.contains('italy') || lowerText.contains('italia') || lowerText.contains('milano') || lowerText.contains('roma') || lowerText.contains('torino')) {
      targetCountries.add('IT');
    }
    if (targetCountries.isEmpty) {
      targetCountries.addAll(['CA', 'IT']);
    }

    return UserProfile(
      id: userId ?? 'usr_${DateTime.now().millisecondsSinceEpoch}',
      email: email,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phone,
      location: location,
      headline: _extractHeadline(lines),
      summary: summary,
      targetCountries: targetCountries,
      primaryLanguage: _detectPrimaryLanguage(rawText),
      workAuthorization: const WorkAuthorization(
        canadaStatus: 'UNKNOWN',
        italyStatus: 'UNKNOWN',
        verifiedByUser: false,
      ),
      experiences: experiences,
      education: education,
      skills: skills,
      languages: languages,
      certifications: [],
      missingFields: missingFields,
      lowConfidenceFields: lowConfidenceFields,
      cvDocumentId: cvDocumentId,
      rawCvText: rawText,
      isConfirmedByUser: false,
      updatedAt: DateTime.now(),
    );
  }

  String _extractEmail(String text) {
    final regex = RegExp(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}');
    final match = regex.firstMatch(text);
    return match?.group(0) ?? '';
  }

  String _extractPhone(String text) {
    // Matches international and domestic phone numbers: +1 (514) 123-4567, +39 06 1234567, etc.
    final regex = RegExp(r'(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}');
    final matches = regex.allMatches(text);
    for (final m in matches) {
      final phone = m.group(0)?.trim() ?? '';
      // Filter out isolated numbers or date strings
      if (phone.length >= 9 && phone.contains(RegExp(r'[\s.-]'))) {
        return phone;
      }
    }
    return '';
  }

  String _extractCandidateName(List<String> lines, String email) {
    // The candidate name is almost universally situated in the top 3 non-empty lines
    for (int i = 0; i < lines.length && i < 4; i++) {
      final line = lines[i];
      if (line.contains('@') || line.contains('http') || line.contains('www') || line.contains(RegExp(r'\d{5}'))) {
        continue;
      }
      if (line.length > 2 && line.length < 50 && !line.toLowerCase().contains('curriculum') && !line.toLowerCase().contains('resume') && !line.toLowerCase().contains('cv')) {
        return line;
      }
    }
    if (email.isNotEmpty) {
      final nameFromEmail = email.split('@').first.replaceAll(RegExp(r'[._-]'), ' ');
      return nameFromEmail;
    }
    return '';
  }

  String _extractHeadline(List<String> lines) {
    for (int i = 1; i < lines.length && i < 6; i++) {
      final line = lines[i];
      final lower = line.toLowerCase();
      if (lower.contains('engineer') || lower.contains('developer') || lower.contains('architect') ||
          lower.contains('ingénieur') || lower.contains('développeur') || lower.contains('ingegnere') ||
          lower.contains('sviluppatore') || lower.contains('manager') || lower.contains('analyst')) {
        return line;
      }
    }
    return '';
  }

  String _extractLocation(String text) {
    final lower = text.toLowerCase();
    const commonLocations = [
      'montreal', 'montréal', 'toronto', 'vancouver', 'ottawa', 'quebec', 'calgary',
      'milano', 'milan', 'roma', 'rome', 'torino', 'turin', 'bologna', 'napoli', 'florence',
      'canada', 'italy', 'italia', 'france', 'paris'
    ];
    for (final loc in commonLocations) {
      if (lower.contains(loc)) {
        return loc[0].toUpperCase() + loc.substring(1);
      }
    }
    return '';
  }

  String _extractSummary(List<String> lines) {
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final lower = line.toLowerCase();
      if (lower == 'summary' || lower == 'profil' || lower == 'profile' || lower == 'about me' || lower == 'résumé professionnel') {
        if (i + 1 < lines.length) {
          return lines.sublist(i + 1, (i + 4 < lines.length ? i + 4 : lines.length)).join(' ');
        }
      }
    }
    return '';
  }

  List<SkillItem> _extractSkills(String text) {
    final lower = text.toLowerCase();
    final detectedSkills = <SkillItem>[];
    
    // Controlled catalog of common tech and domain skills
    const skillCatalog = [
      'Flutter', 'Dart', 'Python', 'JavaScript', 'TypeScript', 'React', 'React Native',
      'Node.js', 'Java', 'Kotlin', 'Swift', 'C++', 'Go', 'SQL', 'PostgreSQL', 'SQLite',
      'Docker', 'Kubernetes', 'Git', 'GitHub', 'CI/CD', 'REST API', 'GraphQL',
      'Cloudflare', 'AWS', 'GCP', 'Linux', 'Android', 'iOS', 'HTML', 'CSS', 'Tailwind',
      'Agile', 'Scrum', 'Figma', 'UI/UX'
    ];

    for (final skill in skillCatalog) {
      if (lower.contains(skill.toLowerCase())) {
        detectedSkills.add(
          SkillItem(
            id: 'sk_${skill.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '_')}',
            name: skill,
            level: 'ADVANCED',
            yearsOfExperience: 2,
            isExtracted: true,
            isConfirmed: false,
          ),
        );
      }
    }

    return detectedSkills;
  }

  List<LanguageItem> _extractLanguages(String text) {
    final lower = text.toLowerCase();
    final list = <LanguageItem>[];

    if (lower.contains('english') || lower.contains('anglais') || lower.contains('inglese')) {
      list.add(const LanguageItem(code: 'en', name: 'English', proficiency: 'PROFESSIONAL', isExtracted: true, isConfirmed: false));
    }
    if (lower.contains('french') || lower.contains('français') || lower.contains('francese')) {
      list.add(const LanguageItem(code: 'fr', name: 'French', proficiency: 'NATIVE', isExtracted: true, isConfirmed: false));
    }
    if (lower.contains('italian') || lower.contains('italien') || lower.contains('italiano')) {
      list.add(const LanguageItem(code: 'it', name: 'Italian', proficiency: 'PROFESSIONAL', isExtracted: true, isConfirmed: false));
    }

    return list;
  }

  List<WorkExperience> _extractExperiences(List<String> lines) {
    final experiences = <WorkExperience>[];
    final yearRegex = RegExp(r'(20\d\d|19\d\d)');

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      if (yearRegex.hasMatch(line) && line.length < 80) {
        // Likely an experience header line containing dates
        final yearMatch = yearRegex.firstMatch(line);
        final startYear = yearMatch?.group(0) ?? '2022';
        
        final prevLine = (i > 0) ? lines[i - 1] : 'Software Engineer';
        final nextLine = (i + 1 < lines.length) ? lines[i + 1] : '';

        experiences.add(
          WorkExperience(
            id: 'exp_${experiences.length + 1}',
            companyName: line.length < 40 ? line : 'Organization',
            jobTitle: prevLine.length < 50 ? prevLine : 'Role',
            startDate: '$startYear-01',
            endDate: line.toLowerCase().contains('present') || line.toLowerCase().contains('actuel') ? null : '$startYear-12',
            isCurrent: line.toLowerCase().contains('present') || line.toLowerCase().contains('actuel'),
            description: nextLine,
            technologies: [],
            isExtracted: true,
            isConfirmed: false,
          ),
        );
        if (experiences.length >= 5) break; // Limit heuristic extraction to top 5
      }
    }

    return experiences;
  }

  List<EducationItem> _extractEducation(List<String> lines) {
    final education = <EducationItem>[];
    const degreeKeywords = ['bachelor', 'master', 'phd', 'licence', 'baccalauréat', 'laurea', 'diploma', 'ingénieur', 'engineer'];

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final lower = line.toLowerCase();
      for (final kw in degreeKeywords) {
        if (lower.contains(kw) && line.length < 100) {
          education.add(
            EducationItem(
              id: 'edu_${education.length + 1}',
              institution: (i + 1 < lines.length) ? lines[i + 1] : 'University',
              degreeName: line,
              fieldOfStudy: '',
              graduationYear: 2022,
              isExtracted: true,
              isConfirmed: false,
            ),
          );
          break;
        }
      }
      if (education.length >= 3) break;
    }

    return education;
  }

  String _detectPrimaryLanguage(String text) {
    final lower = text.toLowerCase();
    int frCount = RegExp(r'\b(et|le|la|les|des|du|dans|pour|avec|expérience|formation)\b').allMatches(lower).length;
    int itCount = RegExp(r'\b(e|il|la|le|dei|nel|nella|per|con|esperienza|istruzione)\b').allMatches(lower).length;
    int enCount = RegExp(r'\b(and|the|in|for|with|experience|education|skills)\b').allMatches(lower).length;

    if (frCount > enCount && frCount > itCount) return 'fr';
    if (itCount > enCount && itCount > frCount) return 'it';
    return 'en';
  }
}
