// Dummy Games API
// In production, these would be real API calls to your backend

import type { Game, Content } from '../types/game';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const gamesApi = {
  getAll: async (userId: string): Promise<Game[]> => {
    await delay(500);
    
    const gamesStr = localStorage.getItem(`games_${userId}`);
    if (!gamesStr) return [];
    
    try {
      return JSON.parse(gamesStr);
    } catch {
      return [];
    }
  },

  create: async (userId: string, game: Game): Promise<Game> => {
    await delay(500);
    
    const games = await gamesApi.getAll(userId);
    games.push(game);
    localStorage.setItem(`games_${userId}`, JSON.stringify(games));
    
    return game;
  },

  update: async (userId: string, gameId: string, updates: Partial<Game>): Promise<Game> => {
    await delay(500);
    
    const games = await gamesApi.getAll(userId);
    const index = games.findIndex(g => g.id === gameId);
    
    if (index === -1) {
      throw new Error('Game not found');
    }
    
    games[index] = { ...games[index], ...updates };
    localStorage.setItem(`games_${userId}`, JSON.stringify(games));
    
    return games[index];
  },

  delete: async (userId: string, gameId: string): Promise<void> => {
    await delay(500);
    
    const games = await gamesApi.getAll(userId);
    const filtered = games.filter(g => g.id !== gameId);
    localStorage.setItem(`games_${userId}`, JSON.stringify(filtered));
  },
};