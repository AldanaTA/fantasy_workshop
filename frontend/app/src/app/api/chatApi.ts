import type { CampaignChatMessage } from './models';

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

function wsBase(): string {
	if (!API_BASE) return '';
	return API_BASE.replace(/^http/, 'ws');
}

export const chatApi = {
	listMessages: (campaignId: string, limit = 50, offset = 0, token?: string) =>
		request<CampaignChatMessage[]>(`/chat/campaigns/${campaignId}/messages?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

	connectCampaignChat: (campaignId: string, token?: string) => {
		const base = wsBase() || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
		const t = token ?? localStorage.getItem('authToken');
		const url = `${base}/ws/campaigns/${campaignId}/chat?token=${encodeURIComponent(t ?? '')}`;
		const ws = new WebSocket(url);
		return ws;
	},
};

