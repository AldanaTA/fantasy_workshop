import { API_CONFIG } from './apiConfig';
import type { ContentCategory } from './models';
import { getAccessToken } from './authStorage';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_CONTENT_CATEGORIES;

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

export const contentCategoriesApi = {
	list: (limit = 50, offset = 0, options?: string | ApiRequestOptions) => {
		const { token, signal } = resolveOptions(options);
		return request<ContentCategory[]>(`?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token), signal });
	},
	listByPack: (packId: string, limit = 50, offset = 0, options?: string | ApiRequestOptions) => {
		const { token, signal } = resolveOptions(options);
		return request<ContentCategory[]>(`/by-pack/${packId}?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token), signal });
	},
	get: (id: string, options?: string | ApiRequestOptions) => {
		const { token, signal } = resolveOptions(options);
		return request<ContentCategory>(`/${id}`, { method: 'GET', headers: authHeaders(token), signal });
	},
	create: (payload: Partial<ContentCategory>, options?: string | ApiRequestOptions) => {
		const { token, signal } = resolveOptions(options);
		return request<ContentCategory>(``, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token), signal });
	},
	patch: (id: string, patch: Partial<ContentCategory>, options?: string | ApiRequestOptions) => {
		const { token, signal } = resolveOptions(options);
		return request<ContentCategory>(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token), signal });
	},
	reorder: (packId: string, categoryIds: string[], options?: string | ApiRequestOptions) => {
		const { token, signal } = resolveOptions(options);
		return (
		request<ContentCategory[]>(`/by-pack/${packId}/order`, {
			method: 'PATCH',
			body: JSON.stringify({ category_ids: categoryIds }),
			headers: authHeaders(token),
			signal,
		})
		);
	},
	delete: (id: string, options?: string | ApiRequestOptions) => {
		const { token, signal } = resolveOptions(options);
		return request<void>(`/userdel/${id}`, { method: 'DELETE', headers: authHeaders(token), signal });
	},
};
