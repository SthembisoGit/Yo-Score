/**
 * Backend returns { success, message, data }. apiClient interceptor returns the full body.
 * Use this to extract the payload for endpoints that wrap the result in data.
 */
export function unwrapData<T>(response: unknown): T {
  const body = response as { data?: T };
  if (body != null && typeof body === 'object' && 'data' in body && body.data !== undefined) {
    return body.data as T;
  }
  return response as T;
}
