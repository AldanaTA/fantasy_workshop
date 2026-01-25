// Dummy Sessions API
// In production, these would be real API calls to your backend

import type { Session, Campaign, Character } from '../types/game';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sessionsApi = {
  getAll: async (userId: string): Promise<Session[]> => {
    await delay(500);
    
    const sessionsStr = localStorage.getItem(`sessions_${userId}`);
    if (!sessionsStr) return [];
    
    try {
      return JSON.parse(sessionsStr);
    } catch {
      return [];
    }
  },

  create: async (userId: string, session: Session): Promise<Session> => {
    await delay(500);
    
    const sessions = await sessionsApi.getAll(userId);
    sessions.push(session);
    localStorage.setItem(`sessions_${userId}`, JSON.stringify(sessions));
    
    return session;
  },

  update: async (userId: string, sessionId: string, updates: Partial<Session>): Promise<Session> => {
    await delay(500);
    
    const sessions = await sessionsApi.getAll(userId);
    const index = sessions.findIndex(s => s.id === sessionId);
    
    if (index === -1) {
      throw new Error('Session not found');
    }
    
    sessions[index] = { ...sessions[index], ...updates };
    localStorage.setItem(`sessions_${userId}`, JSON.stringify(sessions));
    
    return sessions[index];
  },

  delete: async (userId: string, sessionId: string): Promise<void> => {
    await delay(500);
    
    const sessions = await sessionsApi.getAll(userId);
    const filtered = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(`sessions_${userId}`, JSON.stringify(filtered));
  },

  // Campaign methods
  getAllCampaigns: async (userId: string): Promise<Campaign[]> => {
    await delay(500);
    
    const campaignsStr = localStorage.getItem(`campaigns_${userId}`);
    if (!campaignsStr) return [];
    
    try {
      return JSON.parse(campaignsStr);
    } catch {
      return [];
    }
  },

  createCampaign: async (userId: string, campaign: Campaign): Promise<Campaign> => {
    await delay(500);
    
    const campaigns = await sessionsApi.getAllCampaigns(userId);
    campaigns.push(campaign);
    localStorage.setItem(`campaigns_${userId}`, JSON.stringify(campaigns));
    
    return campaign;
  },

  updateCampaign: async (userId: string, campaignId: string, updates: Partial<Campaign>): Promise<Campaign> => {
    await delay(500);
    
    const campaigns = await sessionsApi.getAllCampaigns(userId);
    const index = campaigns.findIndex(c => c.id === campaignId);
    
    if (index === -1) {
      throw new Error('Campaign not found');
    }
    
    campaigns[index] = { ...campaigns[index], ...updates };
    localStorage.setItem(`campaigns_${userId}`, JSON.stringify(campaigns));
    
    return campaigns[index];
  },

  deleteCampaign: async (userId: string, campaignId: string): Promise<void> => {
    await delay(500);
    
    const campaigns = await sessionsApi.getAllCampaigns(userId);
    const filtered = campaigns.filter(c => c.id !== campaignId);
    localStorage.setItem(`campaigns_${userId}`, JSON.stringify(filtered));
  },

  // Character methods
  getAllCharacters: async (userId: string): Promise<Character[]> => {
    await delay(500);
    
    const charactersStr = localStorage.getItem(`characters_${userId}`);
    if (!charactersStr) return [];
    
    try {
      return JSON.parse(charactersStr);
    } catch {
      return [];
    }
  },

  createCharacter: async (userId: string, character: Character): Promise<Character> => {
    await delay(500);
    
    const characters = await sessionsApi.getAllCharacters(userId);
    characters.push(character);
    localStorage.setItem(`characters_${userId}`, JSON.stringify(characters));
    
    return character;
  },

  updateCharacter: async (userId: string, characterId: string, updates: Partial<Character>): Promise<Character> => {
    await delay(500);
    
    const characters = await sessionsApi.getAllCharacters(userId);
    const index = characters.findIndex(c => c.id === characterId);
    
    if (index === -1) {
      throw new Error('Character not found');
    }
    
    characters[index] = { ...characters[index], ...updates };
    localStorage.setItem(`characters_${userId}`, JSON.stringify(characters));
    
    return characters[index];
  },

  deleteCharacter: async (userId: string, characterId: string): Promise<void> => {
    await delay(500);
    
    const characters = await sessionsApi.getAllCharacters(userId);
    const filtered = characters.filter(c => c.id !== characterId);
    localStorage.setItem(`characters_${userId}`, JSON.stringify(filtered));
  },
};