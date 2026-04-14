import { API_CONFIG } from './apiConfig';
import type { ContentCategory } from './models';
import { getAccessToken } from './authStorage';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_CONTENT_CATEGORIES;

const authHeaders = (token?: string) => {
  const t = token ?? getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
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

export const contentCategoriesApi = {
	list: (limit = 50, offset = 0, token?: string) => request<ContentCategory[]>(`?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),
	get: (id: string, token?: string) => request<ContentCategory>(`/${id}`, { method: 'GET', headers: authHeaders(token) }),
	create: (payload: Partial<ContentCategory>, token?: string) => request<ContentCategory>(``, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
	patch: (id: string, patch: Partial<ContentCategory>, token?: string) => request<ContentCategory>(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token) }),
	delete: (id: string, token?: string) => request<void>(`/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
};
