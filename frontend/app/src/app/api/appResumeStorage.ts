import type { UserRole } from '../types/game';

type CreatorResumeState =
  | { view: 'list' }
  | { view: 'packs'; gameId: string }
  | { view: 'preview'; gameId: string };

export type CreatorPackResumeState =
  | { view: 'list' }
  | { view: 'categories'; packId: string; expandedCategoryId?: string | null };

export type GameMasterManageTab = 'details' | 'packs' | 'game-packs' | 'rules' | 'validation' | 'notes' | 'timeline';

type LibraryResumeState =
  | { view: 'list' }
  | { view: 'preview'; gameId: string };

type GameMasterResumeState =
  | { view: 'list'; selectedCampaignId: string | null }
  | { view: 'create'; selectedCampaignId: string | null }
  | { view: 'manage'; campaignId: string; tab?: GameMasterManageTab }
  | { view: 'share'; campaignId: string };

type CampaignSessionsResumeState = {
  expandedCampaignId: string | null;
};

const STORAGE_KEYS = {
  mainSection: 'app_resume_main_section',
  creator: 'app_resume_creator',
  creatorPack: 'app_resume_creator_pack',
  library: 'app_resume_library',
  gameMaster: 'app_resume_gm',
  playerSessions: 'app_resume_player_sessions',
  gmSessions: 'app_resume_gm_sessions',
} as const;

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getSavedMainSection(): UserRole | null {
  const value = readJson<UserRole>(STORAGE_KEYS.mainSection);
  if (value === 'library' || value === 'creator' || value === 'gm' || value === 'player') {
    return value;
  }
  return null;
}

export function setSavedMainSection(section: UserRole) {
  writeJson(STORAGE_KEYS.mainSection, section);
}

export function getSavedCreatorState(): CreatorResumeState | null {
  const value = readJson<CreatorResumeState>(STORAGE_KEYS.creator);
  if (!value || typeof value !== 'object' || !('view' in value)) {
    return null;
  }

  if (value.view === 'list') {
    return value;
  }

  if ((value.view === 'packs' || value.view === 'preview') && typeof value.gameId === 'string' && value.gameId) {
    return value;
  }

  return null;
}

export function setSavedCreatorState(state: CreatorResumeState) {
  writeJson(STORAGE_KEYS.creator, state);
}

export function getSavedCreatorPackState(gameId: string): CreatorPackResumeState | null {
  const value = readJson<Record<string, CreatorPackResumeState>>(STORAGE_KEYS.creatorPack);
  if (!value || typeof value !== 'object') {
    return null;
  }

  const gameState = value[gameId];
  if (!gameState || typeof gameState !== 'object' || !('view' in gameState)) {
    return null;
  }

  if (gameState.view === 'list') {
    return gameState;
  }

  if (gameState.view === 'categories' && typeof gameState.packId === 'string' && gameState.packId) {
    return {
      view: 'categories',
      packId: gameState.packId,
      expandedCategoryId: typeof gameState.expandedCategoryId === 'string' ? gameState.expandedCategoryId : null,
    };
  }

  return null;
}

export function setSavedCreatorPackState(gameId: string, state: CreatorPackResumeState) {
  const currentValue = readJson<Record<string, CreatorPackResumeState>>(STORAGE_KEYS.creatorPack) ?? {};
  writeJson(STORAGE_KEYS.creatorPack, {
    ...currentValue,
    [gameId]: state,
  });
}

export function getSavedLibraryState(): LibraryResumeState | null {
  const value = readJson<LibraryResumeState>(STORAGE_KEYS.library);
  if (!value || typeof value !== 'object' || !('view' in value)) {
    return null;
  }

  if (value.view === 'list') {
    return value;
  }

  if (value.view === 'preview' && typeof value.gameId === 'string' && value.gameId) {
    return value;
  }

  return null;
}

export function setSavedLibraryState(state: LibraryResumeState) {
  writeJson(STORAGE_KEYS.library, state);
}

export function getSavedGameMasterState(): GameMasterResumeState | null {
  const value = readJson<GameMasterResumeState>(STORAGE_KEYS.gameMaster);
  if (!value || typeof value !== 'object' || !('view' in value)) {
    return null;
  }

  if ((value.view === 'list' || value.view === 'create') && ('selectedCampaignId' in value)) {
    return value;
  }

  if (value.view === 'manage' && typeof value.campaignId === 'string' && value.campaignId) {
    const isValidTab =
      value.tab === 'details'
      || value.tab === 'packs'
      || value.tab === 'game-packs'
      || value.tab === 'rules'
      || value.tab === 'validation'
      || value.tab === 'notes'
      || value.tab === 'timeline';

    return {
      view: 'manage',
      campaignId: value.campaignId,
      tab: isValidTab ? value.tab : 'details',
    };
  }

  if (value.view === 'share' && typeof value.campaignId === 'string' && value.campaignId) {
    return value;
  }

  return null;
}

export function setSavedGameMasterState(state: GameMasterResumeState) {
  writeJson(STORAGE_KEYS.gameMaster, state);
}

export function getSavedCampaignSessionsState(role: 'gm' | 'player'): CampaignSessionsResumeState | null {
  const key = role === 'gm' ? STORAGE_KEYS.gmSessions : STORAGE_KEYS.playerSessions;
  const value = readJson<CampaignSessionsResumeState>(key);
  if (!value || typeof value !== 'object' || !('expandedCampaignId' in value)) {
    return null;
  }

  return {
    expandedCampaignId: typeof value.expandedCampaignId === 'string' ? value.expandedCampaignId : null,
  };
}

export function setSavedCampaignSessionsState(role: 'gm' | 'player', state: CampaignSessionsResumeState) {
  const key = role === 'gm' ? STORAGE_KEYS.gmSessions : STORAGE_KEYS.playerSessions;
  writeJson(key, state);
}

export function clearResumeState() {
  if (typeof window === 'undefined') {
    return;
  }

  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
}
