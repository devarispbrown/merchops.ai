/**
 * API Client Base
 * Base fetch wrapper with error handling, JSON parsing, and correlation ID injection
 */

import { getCorrelationId, addCorrelationIdToHeaders } from '../correlation';

import { ApiError, ApiClientError } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

export interface RequestOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean;
  skipCorrelation?: boolean;
}

// ============================================================================
// BASE FETCH WRAPPER
// ============================================================================

/**
 * Base fetch wrapper with automatic:
 * - JSON parsing
 * - Error handling
 * - Correlation ID injection
 * - Timeout handling
 * - Authorization headers
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    skipAuth = false,
    skipCorrelation = false,
    headers = {},
    ...fetchOptions
  } = options;

  // Build full URL
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Build headers
  let requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  // Add correlation ID
  if (!skipCorrelation) {
    requestHeaders = addCorrelationIdToHeaders(requestHeaders, getCorrelationId());
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
      signal: controller.signal,
      credentials: skipAuth ? 'omit' : 'include',
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // Parse JSON response
    return await parseJsonResponse<T>(response);
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError({
        code: 'TIMEOUT',
        message: 'Request timeout',
        statusCode: 408,
      });
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new ApiClientError({
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
        statusCode: 0,
        details: { originalError: error.message },
      });
    }

    // Re-throw ApiClientError
    if (error instanceof ApiClientError) {
      throw error;
    }

    // Unknown error
    throw new ApiClientError({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      statusCode: 500,
    });
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle error responses from API
 */
async function handleErrorResponse(response: Response): Promise<never> {
  let errorData: ApiError;

  try {
    errorData = await response.json();
  } catch {
    // If response body is not JSON, create generic error
    errorData = {
      code: 'UNKNOWN_ERROR',
      message: response.statusText || 'Request failed',
      statusCode: response.status,
    };
  }

  // Ensure statusCode is set
  errorData.statusCode = errorData.statusCode || response.status;

  throw new ApiClientError(errorData);
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Parse JSON response with error handling
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiClientError({
      code: 'PARSE_ERROR',
      message: 'Failed to parse JSON response',
      statusCode: response.status,
      details: { originalError: error instanceof Error ? error.message : 'Unknown' },
    });
  }
}

// ============================================================================
// HTTP METHOD HELPERS
// ============================================================================

/**
 * GET request
 */
export async function get<T = unknown>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST request
 */
export async function post<T = unknown>(
  endpoint: string,
  data?: unknown,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 */
export async function put<T = unknown>(
  endpoint: string,
  data?: unknown,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request
 */
export async function patch<T = unknown>(
  endpoint: string,
  data?: unknown,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function del<T = unknown>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'DELETE',
  });
}

// ============================================================================
// QUERY STRING BUILDER
// ============================================================================

/**
 * Build query string from params object
 * Filters out undefined/null values
 */
export function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';

  const filteredParams = Object.entries(params).reduce(
    (acc, [key, value]) => {
      // Skip undefined/null values
      if (value === undefined || value === null) {
        return acc;
      }

      // Handle arrays
      if (Array.isArray(value)) {
        acc[key] = value.join(',');
        return acc;
      }

      // Handle objects (convert to JSON string)
      if (typeof value === 'object') {
        acc[key] = JSON.stringify(value);
        return acc;
      }

      // Handle primitive values
      acc[key] = String(value);
      return acc;
    },
    {} as Record<string, string>
  );

  const queryString = new URLSearchParams(filteredParams).toString();
  return queryString ? `?${queryString}` : '';
}
