/// Core lifecycle state of a job application in JobPilot.
enum ApplicationState {
  discovered,
  analyzed,
  readyForReview,
  approved,
  submissionPending,
  submitted,
  failed,
  withdrawn,
  closed;

  String toApiString() {
    switch (this) {
      case ApplicationState.discovered:
        return 'DISCOVERED';
      case ApplicationState.analyzed:
        return 'ANALYZED';
      case ApplicationState.readyForReview:
        return 'READY_FOR_REVIEW';
      case ApplicationState.approved:
        return 'APPROVED';
      case ApplicationState.submissionPending:
        return 'SUBMISSION_PENDING';
      case ApplicationState.submitted:
        return 'SUBMITTED';
      case ApplicationState.failed:
        return 'FAILED';
      case ApplicationState.withdrawn:
        return 'WITHDRAWN';
      case ApplicationState.closed:
        return 'CLOSED';
    }
  }

  static ApplicationState fromApiString(String value) {
    switch (value.toUpperCase()) {
      case 'DISCOVERED':
        return ApplicationState.discovered;
      case 'ANALYZED':
        return ApplicationState.analyzed;
      case 'READY_FOR_REVIEW':
        return ApplicationState.readyForReview;
      case 'APPROVED':
        return ApplicationState.approved;
      case 'SUBMISSION_PENDING':
        return ApplicationState.submissionPending;
      case 'SUBMITTED':
        return ApplicationState.submitted;
      case 'FAILED':
        return ApplicationState.failed;
      case 'WITHDRAWN':
        return ApplicationState.withdrawn;
      case 'CLOSED':
      default:
        return ApplicationState.closed;
    }
  }
}

/// Readiness state of an integration or background task.
enum FeatureReadiness {
  notConfigured,
  blocked,
  ready,
  running,
  failed,
  disabled;

  String toApiString() {
    switch (this) {
      case FeatureReadiness.notConfigured:
        return 'NOT_CONFIGURED';
      case FeatureReadiness.blocked:
        return 'BLOCKED';
      case FeatureReadiness.ready:
        return 'READY';
      case FeatureReadiness.running:
        return 'RUNNING';
      case FeatureReadiness.failed:
        return 'FAILED';
      case FeatureReadiness.disabled:
        return 'DISABLED';
    }
  }
}
