import { authStore } from './authStorage';

export function getAuthToken(token?: string): string | null {
  return token ?? authStore.getAccessToken();
}

export function authHeaders(token?: string): Record<string, string> | undefined {
  const resolvedToken = getAuthToken(token);
  return resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : undefined;
}
