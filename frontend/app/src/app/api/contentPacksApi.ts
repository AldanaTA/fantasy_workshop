import { API_CONFIG } from './apiConfig';
import type { ContentPack } from './models';
import { getAccessToken } from './authStorage';
import { fetchWithCache, invalidateCacheByPrefix } from './requestCache';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_CONTENT_PACKS;
const CONTENT_PACKS_CACHE_TTL_MS = 60_000;

type ApiRequestOptions = {
  token?: string;
  signal?: AbortSignal;
};

const contentPacksCacheKeys = {
  byGame: (gameId: string, limit: number, offset: number) => `packs:game:${gameId}:l=${limit}:o=${offset}`,
};

export function invalidateContentPacksByGame(gameId: string) {
  invalidateCacheByPrefix(`packs:game:${gameId}:`);
}

const authHeaders = (token?: string) => {
  const t = token ?? getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

const resolveOptions = (options?: string | ApiRequestOptions): ApiRequestOptions => (
  typeof options === 'string' ? { token: options } : options ?? {}
);

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) } as Record<string, string>;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 204) return undefined as unknown as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail || res.statusText;
    throw new Error(detail);
  }
  return data as T;
}

export const contentPacksApi = {
  list: (limit = 50, offset = 0, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentPack[]>(`?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token), signal });
  },

  listByGame: (gameId: string, limit = 50, offset = 0, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return fetchWithCache(
      contentPacksCacheKeys.byGame(gameId, limit, offset),
      () => request<ContentPack[]>(`/by-game/${gameId}?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CONTENT_PACKS_CACHE_TTL_MS, signal },
    );
  },

  get: (id: string, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentPack>(`/${id}`, { method: 'GET', headers: authHeaders(token), signal });
  },

  create: (payload: Partial<ContentPack>, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentPack>(``, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token), signal }).then((pack) => {
      invalidateContentPacksByGame(pack.game_id);
      return pack;
    });
  },

  patch: (id: string, patch: Partial<ContentPack>, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentPack>(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token), signal }).then((pack) => {
      invalidateContentPacksByGame(pack.game_id);
      return pack;
    });
  },

  delete: (id: string, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<void>(`/userdel/${id}`, { method: 'DELETE', headers: authHeaders(token), signal });
  },
};
