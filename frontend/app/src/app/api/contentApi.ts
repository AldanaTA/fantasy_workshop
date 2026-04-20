import { API_CONFIG } from './apiConfig';
import type {
  Content,
  ContentCategoryMembership,
  ContentCategoryMembershipCreate,
  ContentCreate,
  ContentVersion,
  ContentVersionCreate,
  ContentActiveVersion,
  ContentWithActiveVersion,
} from './models';
import { validateContentFields } from '../types/contentFields';
import { getAccessToken } from './authStorage';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_CONTENT;

type ApiRequestOptions = {
  token?: string;
  signal?: AbortSignal;
};

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

const validateContentVersionPayload = (payload: ContentVersionCreate) => {
  const errors = validateContentFields(payload.fields);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }
};

export const contentApi = {
  create: (payload: ContentCreate, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<Content>('', { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token), signal });
  },

  get: (contentId: string, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<Content>(`/${contentId}`, { method: 'GET', headers: authHeaders(token), signal });
  },

  list: (limit = 50, offset = 0, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<Content[]>(`?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token), signal });
  },

  listByPack: (packId: string, limit = 50, offset = 0, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<Content[]>(`/by-pack/${packId}?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token), signal });
  },

  listByCategory: (categoryId: string, limit = 50, offset = 0, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<Content[]>(`/by-category/${categoryId}?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token), signal });
  },

  listByCategoryWithActive: (categoryId: string, limit = 50, offset = 0, includeMissing = true, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentWithActiveVersion[]>(
      `/by-category/${categoryId}/active?limit=${limit}&offset=${offset}&include_missing=${includeMissing}`,
      { method: 'GET', headers: authHeaders(token), signal },
    );
  },

  addToCategory: (payload: ContentCategoryMembershipCreate, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentCategoryMembership>('/category-memberships', { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token), signal });
  },

  removeFromCategory: (categoryId: string, contentId: string, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<void>(`/category-memberships/${categoryId}/${contentId}`, { method: 'DELETE', headers: authHeaders(token), signal });
  },

  patch: (contentId: string, patch: Partial<Content>, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<Content>(`/${contentId}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token), signal });
  },

  delete: (contentId: string, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<void>(`/${contentId}`, { method: 'DELETE', headers: authHeaders(token), signal });
  },

  // Versions
  createVersion: (contentId: string, payload: ContentVersionCreate, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    validateContentVersionPayload(payload);
    return request<ContentVersion>(`/${contentId}/versions`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token), signal });
  },

  listVersions: (contentId: string, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentVersion[]>(`/${contentId}/versions`, { method: 'GET', headers: authHeaders(token), signal });
  },

  getVersion: (contentId: string, versionNum: number, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentVersion>(`/${contentId}/versions/${versionNum}`, { method: 'GET', headers: authHeaders(token), signal });
  },

  // Active
  upsertActive: (contentId: string, payload: Partial<ContentActiveVersion>, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentActiveVersion>(`/${contentId}/active`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token), signal });
  },

  getActive: (contentId: string, options?: string | ApiRequestOptions) => {
    const { token, signal } = resolveOptions(options);
    return request<ContentVersion>(`/${contentId}/active`, { method: 'GET', headers: authHeaders(token), signal });
  },
};
