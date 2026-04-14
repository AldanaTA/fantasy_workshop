import { API_CONFIG } from "./apiConfig";
import type { TokenPair } from "./models";


const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_auth
async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
	const url = `${API_URL}${path}`;
	const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) } as Record<string, string>;
	const res = await fetch(url, { ...opts, headers });
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		const detail = data?.detail || res.statusText;
		throw new Error(detail);
	}
	return data as T;
}

export const authApi = {
	login: (payload: { email: string; display_name_if_new?: string; password?: string }) =>
		request<TokenPair>(`/login`, { method: 'POST', body: JSON.stringify(payload) }),

	refresh: (payload: { refresh_token: string }) => request<TokenPair>(`/refresh`, { method: 'POST', body: JSON.stringify(payload) }),
	logout: (payload: { refresh_token: string }) => request<{ message: string }>(`/logout`, { method: 'POST', body: JSON.stringify(payload) }),
};

