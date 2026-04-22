import { API_CONFIG } from './apiConfig';
import type { AuthIdentity } from './models';
import { getAccessToken } from './authStorage';

const API_URL = API_CONFIG.VITE_API_BASE + '/' + API_CONFIG.VITE_AUTH_IDENTITIES

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

export const authIdentitiesApi = {
	list: (limit = 50, offset = 0, token?: string) => request<AuthIdentity[]>(`?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),
	get: (id: string, token?: string) => request<AuthIdentity>(`/${id}`, { method: 'GET', headers: authHeaders(token) }),
	create: (payload: Partial<AuthIdentity>, token?: string) => request<AuthIdentity>(``, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
	patch: (id: string, patch: Partial<AuthIdentity>, token?: string) => request<AuthIdentity>(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token) }),
	delete: (id: string, token?: string) => request<void>(`/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
};
