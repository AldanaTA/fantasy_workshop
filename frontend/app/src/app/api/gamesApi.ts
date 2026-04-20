import { API_CONFIG } from './apiConfig';
import type {
  Game,
  GameCreate,
  GameShareAcceptResult,
  GameShareLink,
  GameShareLinkCreate,
  GameSharePreview,
  LibraryGame,
} from './models';
import { getAccessToken } from './authStorage';

const API_URL = API_CONFIG.VITE_API_BASE + "/" + API_CONFIG.VITE_GAMES;
const SHARE_API_URL = API_CONFIG.VITE_API_BASE + "/game-share-links";
const authHeaders = (token?: string) => {
  const t = token ?? getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

async function request<T>(baseUrl: string, path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${baseUrl}${path}`;
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

export const gamesApi = {
  list: (limit = 50, offset = 0, token?: string) => request<Game[]>(API_URL, `?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  listEditable: (limit = 50, offset = 0, token?: string) =>
    request<Game[]>(API_URL, `/editable?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  listLibrary: (limit = 50, offset = 0, token?: string) =>
    request<LibraryGame[]>(API_URL, `/library?limit=${limit}&offset=${offset}`, { method: 'GET', headers: authHeaders(token) }),

  create: (payload: GameCreate, token?: string) => request<Game>(API_URL, ``, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),

  patch: (id: string, patch: Partial<Game>, token?: string) => request<Game>(API_URL, `/${id}`, { method: 'PATCH', body: JSON.stringify(patch), headers: authHeaders(token) }),

  delete: (id: string, token?: string) => request<void>(API_URL, `/${id}`, { method: 'DELETE', headers: authHeaders(token) }),

  createShareLink: (gameId: string, payload: GameShareLinkCreate, token?: string) =>
    request<GameShareLink>(API_URL, `/${gameId}/share-links`, { method: 'POST', body: JSON.stringify(payload), headers: authHeaders(token) }),

  listShareLinks: (gameId: string, token?: string) =>
    request<GameShareLink[]>(API_URL, `/${gameId}/share-links`, { method: 'GET', headers: authHeaders(token) }),

  revokeShareLink: (gameId: string, shareLinkId: string, token?: string) =>
    request<void>(API_URL, `/${gameId}/share-links/${shareLinkId}`, { method: 'DELETE', headers: authHeaders(token) }),

  getShareLinkPreview: (token: string) =>
    request<GameSharePreview>(SHARE_API_URL, `/${token}`, { method: 'GET' }),

  acceptShareLink: (token: string, accessToken?: string) =>
    request<GameShareAcceptResult>(SHARE_API_URL, `/${token}/accept`, { method: 'POST', headers: authHeaders(accessToken) }),
};
