import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../domain/job_listing.dart';

abstract class JobRepository {
  Future<JobDiscoveryResult> fetchJobs({
    String country = 'ALL',
    String query = '',
    String location = '',
    bool isRemote = false,
    int page = 1,
    int limit = 20,
    String? authToken,
  });

  Future<JobListing?> getJobById(String id, {String? authToken});
}

class BackendJobRepository implements JobRepository {
  final String baseUrl;
  final http.Client client;

  BackendJobRepository({
    this.baseUrl = AppConstants.defaultApiBaseUrl,
    http.Client? client,
  }) : client = client ?? http.Client();

  @override
  Future<JobDiscoveryResult> fetchJobs({
    String country = 'ALL',
    String query = '',
    String location = '',
    bool isRemote = false,
    int page = 1,
    int limit = 20,
    String? authToken,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1/jobs').replace(
      queryParameters: {
        if (country != 'ALL') 'country': country,
        if (query.isNotEmpty) 'q': query,
        if (location.isNotEmpty) 'location': location,
        if (isRemote) 'remote': 'true',
        'page': page.toString(),
        'limit': limit.toString(),
      },
    );

    final headers = <String, String>{
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    try {
      final response = await client.get(uri, headers: headers).timeout(
        const Duration(seconds: 10),
      );

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['success'] == true && decoded['data'] != null) {
          return JobDiscoveryResult.fromJson(decoded['data'] as Map<String, dynamic>);
        }
      }

      final errorMsg = _extractErrorMessage(response.body, response.statusCode);
      throw Exception(errorMsg);
    } catch (e) {
      if (e is Exception && e.toString().contains('JobPilot API Exception')) {
        rethrow;
      }
      throw Exception('Failed to connect to Job Discovery backend: $e');
    }
  }

  @override
  Future<JobListing?> getJobById(String id, {String? authToken}) async {
    final uri = Uri.parse('$baseUrl/api/v1/jobs/$id');
    final headers = <String, String>{
      'Accept': 'application/json',
      if (authToken != null) 'Authorization': 'Bearer $authToken',
    };

    try {
      final response = await client.get(uri, headers: headers).timeout(
        const Duration(seconds: 10),
      );

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body) as Map<String, dynamic>;
        if (decoded['success'] == true && decoded['data'] != null) {
          return JobListing.fromJson(decoded['data'] as Map<String, dynamic>);
        }
      }
      return null;
    } catch (e) {
      throw Exception('Failed to fetch job details: $e');
    }
  }

  String _extractErrorMessage(String body, int statusCode) {
    try {
      final map = jsonDecode(body) as Map<String, dynamic>;
      if (map['error'] != null && map['error']['message'] != null) {
        return 'JobPilot API Exception (${map['error']['code'] ?? statusCode}): ${map['error']['message']}';
      }
    } catch (_) {}
    return 'Server returned status $statusCode';
  }
}

final jobRepositoryProvider = Provider<JobRepository>((ref) {
  return BackendJobRepository();
});
