import { API_CONFIG } from './apiConfig';
import type {
  Campaign,
  UserCampaignRole,
  Character,
  CampaignCharacter,
  CampaignCharacterLoad,
  CampaignCharacterValidation,
  CampaignNote,
  CampaignNoteRevision,
  CampaignNoteCreateInput,
  CampaignNoteUpdateInput,
  CampaignAllowedPack,
  CampaignContentVersion,
  CampaignContentVersionUpsert,
  CampaignEvent,
  CampaignCharacterStateSnapshot,
  CampaignCharacterLatestSnapshot,
} from './models';
import { getAccessToken } from './authStorage';
import { fetchWithCache, invalidateCacheByPrefix } from './requestCache';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_CAMPAIGNS;
const CAMPAIGNS_CACHE_TTL_MS = 60_000;

const campaignsCacheKeys = {
  gmList: () => 'campaigns:gm',
  playerList: () => 'campaigns:player',
  campaign: (campaignId: string) => `campaigns:item:${campaignId}`,
  roles: (campaignId: string) => `campaigns:${campaignId}:roles`,
  campaignCharacters: (campaignId: string) => `campaigns:${campaignId}:characters`,
  campaignCharacterLoad: (campaignId: string, campaignCharacterId: string) =>
    `campaigns:${campaignId}:characters:${campaignCharacterId}:load`,
  campaignCharacterValidation: (campaignId: string, campaignCharacterId: string) =>
    `campaigns:${campaignId}:characters:${campaignCharacterId}:validation`,
  notes: (campaignId: string, includeArchived: boolean, visibility: 'all' | 'gm' | 'shared', limit: number, offset: number) =>
    `campaigns:${campaignId}:notes:archived=${includeArchived ? 1 : 0}:visibility=${visibility}:l=${limit}:o=${offset}`,
  note: (campaignId: string, noteId: string) => `campaigns:${campaignId}:notes:${noteId}`,
  noteRevisions: (campaignId: string, noteId: string) => `campaigns:${campaignId}:notes:${noteId}:revisions`,
  allowedPacks: (campaignId: string) => `campaigns:${campaignId}:allowed-packs`,
  pins: (campaignId: string) => `campaigns:${campaignId}:pins`,
  snapshot: (campaignId: string, snapshotId: string) => `campaigns:${campaignId}:snapshots:${snapshotId}`,
};

function invalidateCampaignLists() {
  invalidateCacheByPrefix('campaigns:gm');
  invalidateCacheByPrefix('campaigns:player');
}

function invalidateCampaignDetails(campaignId: string) {
  invalidateCacheByPrefix(`${campaignsCacheKeys.campaign(campaignId)}`);
  invalidateCacheByPrefix(`campaigns:${campaignId}:roles`);
  invalidateCacheByPrefix(`campaigns:${campaignId}:characters`);
  invalidateCacheByPrefix(`campaigns:${campaignId}:notes`);
  invalidateCacheByPrefix(`campaigns:${campaignId}:allowed-packs`);
  invalidateCacheByPrefix(`campaigns:${campaignId}:pins`);
  invalidateCacheByPrefix(`campaigns:${campaignId}:snapshots`);
}

function invalidateCampaignNotes(campaignId: string, noteId?: string) {
  invalidateCacheByPrefix(`campaigns:${campaignId}:notes`);
  if (noteId) {
    invalidateCacheByPrefix(`${campaignsCacheKeys.note(campaignId, noteId)}`);
    invalidateCacheByPrefix(`${campaignsCacheKeys.noteRevisions(campaignId, noteId)}`);
  }
}

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

export const campaignsApi = {
  // campaigns
  create: async (payload: Partial<Campaign>, token?: string) => {
    const campaign = await request<Campaign>(``, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) });
    invalidateCampaignLists();
    invalidateCampaignDetails(campaign.id);
    return campaign;
  },
  get: (id: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.campaign(id),
      () => request<Campaign>(`/${id}`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  listGm: (token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.gmList(),
      () => request<Campaign[]>(`/gm`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  listPlayer: (token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.playerList(),
      () => request<Campaign[]>(`/player`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  patch: async (id: string, patch: Partial<Campaign>, token?: string) => {
    const campaign = await request<Campaign>(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token) });
    invalidateCampaignLists();
    invalidateCampaignDetails(id);
    return campaign;
  },
  delete: async (id: string, token?: string) => {
    await request<void>(`/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    invalidateCampaignLists();
    invalidateCampaignDetails(id);
  },

  // roles
  upsertRole: (campaignId: string, userId: string, payload: Partial<UserCampaignRole>, token?: string) =>
    request<UserCampaignRole>(`/${campaignId}/roles/${userId}`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }).then((role) => {
      invalidateCacheByPrefix(campaignsCacheKeys.roles(campaignId));
      return role;
    }),
  listRoles: (campaignId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.roles(campaignId),
      () => request<UserCampaignRole[]>(`/${campaignId}/roles`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  deleteRole: (campaignId: string, userId: string, token?: string) =>
    request<void>(`/${campaignId}/roles/${userId}`, { method: 'DELETE', headers: authHeaders(token) }).then(() => {
      invalidateCacheByPrefix(campaignsCacheKeys.roles(campaignId));
    }),

  // characters
  createCharacter: (payload: Partial<Character>, token?: string) => request<Character>(`/characters`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
  getCharacter: (characterId: string, token?: string) => request<Character>(`/characters/${characterId}`, { method: 'GET', headers: authHeaders(token) }),

  // campaign characters
  addCampaignCharacter: (campaignId: string, payload: Partial<CampaignCharacter>, token?: string) =>
    request<CampaignCharacter>(`/${campaignId}/characters`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }).then((campaignCharacter) => {
      invalidateCacheByPrefix(campaignsCacheKeys.campaignCharacters(campaignId));
      return campaignCharacter;
    }),
  listCampaignCharacters: (campaignId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.campaignCharacters(campaignId),
      () => request<CampaignCharacter[]>(`/${campaignId}/characters`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  removeCampaignCharacter: (campaignId: string, campaignCharacterId: string, token?: string) =>
    request<void>(`/${campaignId}/characters/${campaignCharacterId}`, { method: 'DELETE', headers: authHeaders(token) }).then(() => {
      invalidateCacheByPrefix(campaignsCacheKeys.campaignCharacters(campaignId));
      invalidateCacheByPrefix(campaignsCacheKeys.campaignCharacterLoad(campaignId, campaignCharacterId));
      invalidateCacheByPrefix(campaignsCacheKeys.campaignCharacterValidation(campaignId, campaignCharacterId));
    }),
  loadCampaignCharacter: (campaignId: string, campaignCharacterId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.campaignCharacterLoad(campaignId, campaignCharacterId),
      () => request<CampaignCharacterLoad>(`/${campaignId}/characters/${campaignCharacterId}/load`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  validateCampaignCharacter: (campaignId: string, campaignCharacterId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.campaignCharacterValidation(campaignId, campaignCharacterId),
      () => request<CampaignCharacterValidation>(`/${campaignId}/characters/${campaignCharacterId}/validation`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  saveCampaignCharacter: (campaignId: string, campaignCharacterId: string, payload: { sheet: Record<string, unknown>; campaign_overrides?: Record<string, unknown> }, token?: string) =>
    request<CampaignCharacterLoad>(`/${campaignId}/characters/${campaignCharacterId}/save`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }).then((result) => {
      invalidateCacheByPrefix(campaignsCacheKeys.campaignCharacters(campaignId));
      invalidateCacheByPrefix(campaignsCacheKeys.campaignCharacterLoad(campaignId, campaignCharacterId));
      invalidateCacheByPrefix(campaignsCacheKeys.campaignCharacterValidation(campaignId, campaignCharacterId));
      return result;
    }),

  // notes
  listNotes: (
    campaignId: string,
    options?: {
      includeArchived?: boolean;
      visibility?: 'all' | 'gm' | 'shared';
      limit?: number;
      offset?: number;
      token?: string;
    },
  ) => {
    const params = new URLSearchParams();
    const includeArchived = options?.includeArchived ?? false;
    const visibility = options?.visibility ?? 'all';
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    if (includeArchived) params.set('include_archived', 'true');
    if (visibility !== 'all') params.set('visibility', visibility);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const query = params.toString();
    return fetchWithCache(
      campaignsCacheKeys.notes(campaignId, includeArchived, visibility, limit, offset),
      () => request<CampaignNote[]>(
        `/${campaignId}/notes${query ? `?${query}` : ''}`,
        { method: 'GET', headers: authHeaders(options?.token) },
      ),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    );
  },
  createNote: (campaignId: string, payload: CampaignNoteCreateInput, token?: string) =>
    request<CampaignNote>(`/${campaignId}/notes`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }).then((note) => {
      invalidateCampaignNotes(campaignId, note.id);
      return note;
    }),
  getNote: (campaignId: string, noteId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.note(campaignId, noteId),
      () => request<CampaignNote>(`/${campaignId}/notes/${noteId}`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  patchNote: (campaignId: string, noteId: string, payload: CampaignNoteUpdateInput, token?: string) =>
    request<CampaignNote>(`/${campaignId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(payload), headers: authHeaders(token) }).then((note) => {
      invalidateCampaignNotes(campaignId, noteId);
      return note;
    }),
  deleteNote: (campaignId: string, noteId: string, token?: string) =>
    request<void>(`/${campaignId}/notes/${noteId}`, { method: 'DELETE', headers: authHeaders(token) }).then(() => {
      invalidateCampaignNotes(campaignId, noteId);
    }),
  restoreNote: (campaignId: string, noteId: string, token?: string) =>
    request<CampaignNote>(`/${campaignId}/notes/${noteId}/restore`, { method: 'POST', headers: authHeaders(token) }).then((note) => {
      invalidateCampaignNotes(campaignId, noteId);
      return note;
    }),
  listNoteRevisions: (campaignId: string, noteId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.noteRevisions(campaignId, noteId),
      () => request<CampaignNoteRevision[]>(`/${campaignId}/notes/${noteId}/revisions`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),

  // allowed packs
  listAllowedPacks: (campaignId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.allowedPacks(campaignId),
      () => request<CampaignAllowedPack[]>(`/${campaignId}/allowed-packs`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  allowPack: (campaignId: string, packId: string, token?: string) =>
    request<CampaignAllowedPack>(`/${campaignId}/allowed-packs/${packId}`, { method: 'PUT', headers: authHeaders(token) }).then((allowedPack) => {
      invalidateCacheByPrefix(campaignsCacheKeys.allowedPacks(campaignId));
      return allowedPack;
    }),
  revokePack: (campaignId: string, packId: string, token?: string) =>
    request<void>(`/${campaignId}/allowed-packs/${packId}`, { method: 'DELETE', headers: authHeaders(token) }).then(() => {
      invalidateCacheByPrefix(campaignsCacheKeys.allowedPacks(campaignId));
    }),

  // pins
  upsertPin: (campaignId: string, contentId: string, payload: CampaignContentVersionUpsert, token?: string) =>
    request<CampaignContentVersion>(`/${campaignId}/pins/${contentId}`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }).then((pin) => {
      invalidateCacheByPrefix(campaignsCacheKeys.pins(campaignId));
      return pin;
    }),
  listPins: (campaignId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.pins(campaignId),
      () => request<CampaignContentVersion[]>(`/${campaignId}/pins`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  deletePin: (campaignId: string, contentId: string, token?: string) =>
    request<void>(`/${campaignId}/pins/${contentId}`, { method: 'DELETE', headers: authHeaders(token) }).then(() => {
      invalidateCacheByPrefix(campaignsCacheKeys.pins(campaignId));
    }),

  // events
  appendEvent: (campaignId: string, payload: Partial<CampaignEvent>, token?: string) =>
    request<CampaignEvent>(`/${campaignId}/events`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),
  listEvents: (campaignId: string, limit = 50, offset = 0, token?: string) =>
    request<CampaignEvent[]>(`/${campaignId}/events?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  // snapshots
  createSnapshot: (campaignId: string, payload: Partial<CampaignCharacterStateSnapshot>, token?: string) =>
    request<CampaignCharacterStateSnapshot>(`/${campaignId}/snapshots`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }).then((snapshot) => {
      invalidateCacheByPrefix(`campaigns:${campaignId}:snapshots`);
      return snapshot;
    }),
  getSnapshot: (campaignId: string, snapshotId: string, token?: string) =>
    fetchWithCache(
      campaignsCacheKeys.snapshot(campaignId, snapshotId),
      () => request<CampaignCharacterStateSnapshot>(`/${campaignId}/snapshots/${snapshotId}`, { method: 'GET', headers: authHeaders(token) }),
      { ttlMs: CAMPAIGNS_CACHE_TTL_MS },
    ),
  upsertLatestSnapshot: (campaignId: string, id: string, payload: Partial<CampaignCharacterLatestSnapshot>, token?: string) =>
    request<CampaignCharacterLatestSnapshot>(`/${campaignId}/latest-snapshots/${id}`, { method: 'PUT', body: JSON.stringify(payload), headers: authHeaders(token) }),
};
