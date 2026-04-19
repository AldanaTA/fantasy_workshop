import { API_CONFIG } from './apiConfig';
import type {
  Content,
  ContentCategoryMembership,
  ContentCategoryMembershipCreate,
  ContentCreate,
  ContentVersion,
  ContentVersionCreate,
  ContentActiveVersion,
} from './models';
import { validateContentFields } from '../types/contentFields';
import { getAccessToken } from './authStorage';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_CONTENT;

const authHeaders = (token?: string) => {
  const t = token ?? getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

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
  create: (payload: ContentCreate, token?: string) =>
    request<Content>('', { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),

  get: (contentId: string, token?: string) => request<Content>(`/${contentId}`, { method: 'GET', headers: authHeaders(token) }),

  list: (limit = 50, offset = 0, token?: string) => request<Content[]>(`?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  listByPack: (packId: string, limit = 50, offset = 0, token?: string) =>
    request<Content[]>(`/by-pack/${packId}?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  listByCategory: (categoryId: string, limit = 50, offset = 0, token?: string) =>
    request<Content[]>(`/by-category/${categoryId}?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  addToCategory: (payload: ContentCategoryMembershipCreate, token?: string) =>
    request<ContentCategoryMembership>('/category-memberships', { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),

  removeFromCategory: (categoryId: string, contentId: string, token?: string) =>
    request<void>(`/category-memberships/${categoryId}/${contentId}`, { method: 'DELETE', headers: authHeaders(token) }),

  patch: (contentId: string, patch: Partial<Content>, token?: string) =>
    request<Content>(`/${contentId}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token) }),

  delete: (contentId: string, token?: string) => request<void>(`/${contentId}`, { method: 'DELETE', headers: authHeaders(token) }),

  // Versions
  createVersion: (contentId: string, payload: ContentVersionCreate, token?: string) => {
    validateContentVersionPayload(payload);
    return request<ContentVersion>(`/${contentId}/versions`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) });
  },

  listVersions: (contentId: string, token?: string) => request<ContentVersion[]>(`/${contentId}/versions`, { method: 'GET', headers: authHeaders(token) }),

  getVersion: (contentId: string, versionNum: number, token?: string) =>
    request<ContentVersion>(`/${contentId}/versions/${versionNum}`, { method: 'GET', headers: authHeaders(token) }),

  // Active
  upsertActive: (contentId: string, payload: Partial<ContentActiveVersion>, token?: string) =>
    request<ContentActiveVersion>(`/${contentId}/active`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }),

  getActive: (contentId: string, token?: string) => request<ContentVersion>(`/${contentId}/active`, { method: 'GET', headers: authHeaders(token) }),
};
