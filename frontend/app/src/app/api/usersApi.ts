import type { User } from './models';

const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';

const authHeaders = (token?: string) => {
	const t = token ?? localStorage.getItem('authToken');
	return t ? { Authorization: `Bearer ${t}` } : {};
};

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
	const url = `${API_BASE}${path}`;
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

export const usersApi = {
	list: (limit = 50, offset = 0, token?: string) => request<User[]>(`/users?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),
	get: (id: string, token?: string) => request<User>(`/users/${id}`, { method: 'GET', headers: authHeaders(token) }),
	create: (payload: Partial<User>, token?: string) => request<User>(`/users`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
	patch: (id: string, patch: Partial<User>, token?: string) => request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token) }),
	delete: (id: string, token?: string) => request<void>(`/users/${id}`, { method: 'DELETE', headers: authHeaders(token) }),
};
