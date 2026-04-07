import { API_CONFIG } from './config';
import type {
  Campaign,
  UserCampaignRole,
  Character,
  CampaignCharacter,
  CampaignContentVersion,
  CampaignEvent,
  CampaignCharacterStateSnapshot,
  CampaignCharacterLatestSnapshot,
} from './models';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_CAMPAIGNS

const authHeaders = (token?: string) => {
  const t = token ?? localStorage.getItem('authToken');
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

export const campaignsApi = {
  // campaigns
  create: (payload: Partial<Campaign>, token?: string) => request<Campaign>(``, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
  get: (id: string, token?: string) => request<Campaign>(`/${id}`, { method: 'GET', headers: authHeaders(token) }),
  list: (limit = 50, offset = 0, token?: string) => request<Campaign[]>(`?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),
  patch: (id: string, patch: Partial<Campaign>, token?: string) => request<Campaign>(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token) }),
  delete: (id: string, token?: string) => request<void>(`/${id}`, { method: 'DELETE', headers: authHeaders(token) }),

  // roles
  upsertRole: (campaignId: string, userId: string, payload: Partial<UserCampaignRole>, token?: string) =>
    request<UserCampaignRole>(`/${campaignId}/roles/${userId}`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }),
  listRoles: (campaignId: string, token?: string) => request<UserCampaignRole[]>(`/${campaignId}/roles`, { method: 'GET', headers: authHeaders(token) }),
  deleteRole: (campaignId: string, userId: string, token?: string) => request<void>(`/${campaignId}/roles/${userId}`, { method: 'DELETE', headers: authHeaders(token) }),

  // characters
  createCharacter: (payload: Partial<Character>, token?: string) => request<Character>(`/characters`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
  getCharacter: (characterId: string, token?: string) => request<Character>(`/characters/${characterId}`, { method: 'GET', headers: authHeaders(token) }),

  // campaign characters
  addCampaignCharacter: (campaignId: string, payload: Partial<CampaignCharacter>, token?: string) =>
    request<CampaignCharacter>(`/${campaignId}/characters`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
  listCampaignCharacters: (campaignId: string, token?: string) => request<CampaignCharacter[]>(`/${campaignId}/characters`, { method: 'GET', headers: authHeaders(token) }),
  removeCampaignCharacter: (campaignId: string, campaignCharacterId: string, token?: string) =>
    request<void>(`/${campaignId}/characters/${campaignCharacterId}`, { method: 'DELETE', headers: authHeaders(token) }),

  // pins
  upsertPin: (campaignId: string, contentId: string, payload: Partial<CampaignContentVersion>, token?: string) =>
    request<CampaignContentVersion>(`/${campaignId}/pins/${contentId}`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }),
  listPins: (campaignId: string, token?: string) => request<CampaignContentVersion[]>(`/${campaignId}/pins`, { method: 'GET', headers: authHeaders(token) }),
  deletePin: (campaignId: string, contentId: string, token?: string) => request<void>(`/${campaignId}/pins/${contentId}`, { method: 'DELETE', headers: authHeaders(token) }),

  // events
  appendEvent: (campaignId: string, payload: Partial<CampaignEvent>, token?: string) =>
    request<CampaignEvent>(`/${campaignId}/events`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
  listEvents: (campaignId: string, limit = 50, offset = 0, token?: string) =>
    request<CampaignEvent[]>(`/${campaignId}/events?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  // snapshots
  createSnapshot: (campaignId: string, payload: Partial<CampaignCharacterStateSnapshot>, token?: string) =>
    request<CampaignCharacterStateSnapshot>(`/${campaignId}/snapshots`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
  getSnapshot: (campaignId: string, snapshotId: string, token?: string) =>
    request<CampaignCharacterStateSnapshot>(`/${campaignId}/snapshots/${snapshotId}`, { method: 'GET', headers: authHeaders(token) }),
  upsertLatestSnapshot: (campaignId: string, id: string, payload: Partial<CampaignCharacterLatestSnapshot>, token?: string) =>
    request<CampaignCharacterLatestSnapshot>(`/${campaignId}/latest-snapshots/${id}`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }),
};
