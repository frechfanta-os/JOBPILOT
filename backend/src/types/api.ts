export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  correlation_id: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export function createSuccessResponse<T>(data: T, correlationId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    correlation_id: correlationId || `corr-${crypto.randomUUID()}`,
  };
}

export function createErrorResponse(code: string, message: string, details?: Record<string, any>, correlationId?: string): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    correlation_id: correlationId || `corr-${crypto.randomUUID()}`,
  };
}
