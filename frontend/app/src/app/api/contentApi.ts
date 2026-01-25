// Dummy Content API
// In production, these would be real API calls to your backend

import type { Content } from '../types/game';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const contentApi = {
  getAll: async (userId: string): Promise<Content[]> => {
    await delay(500);
    
    const contentStr = localStorage.getItem(`content_${userId}`);
    if (!contentStr) return [];
    
    try {
      return JSON.parse(contentStr);
    } catch {
      return [];
    }
  },

  getByGame: async (userId: string, gameId: string): Promise<Content[]> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    return allContent.filter(c => c.gameId === gameId);
  },

  getById: async (userId: string, contentId: string): Promise<Content | null> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    return allContent.find(c => c.id === contentId) || null;
  },

  create: async (userId: string, content: Content): Promise<Content> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    allContent.push(content);
    localStorage.setItem(`content_${userId}`, JSON.stringify(allContent));
    
    return content;
  },

  update: async (userId: string, contentId: string, updates: Partial<Content>): Promise<Content> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    const index = allContent.findIndex(c => c.id === contentId);
    
    if (index === -1) {
      throw new Error('Content not found');
    }
    
    allContent[index] = { ...allContent[index], ...updates };
    localStorage.setItem(`content_${userId}`, JSON.stringify(allContent));
    
    return allContent[index];
  },

  delete: async (userId: string, contentId: string): Promise<void> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    const filtered = allContent.filter(c => c.id !== contentId);
    localStorage.setItem(`content_${userId}`, JSON.stringify(filtered));
  },

  bulkCreate: async (userId: string, contentList: Content[]): Promise<Content[]> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    allContent.push(...contentList);
    localStorage.setItem(`content_${userId}`, JSON.stringify(allContent));
    
    return contentList;
  },

  bulkDelete: async (userId: string, contentIds: string[]): Promise<void> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    const filtered = allContent.filter(c => !contentIds.includes(c.id));
    localStorage.setItem(`content_${userId}`, JSON.stringify(filtered));
  },

  getByCategory: async (userId: string, gameId: string, categoryId: string): Promise<Content[]> => {
    await delay(500);
    
    const allContent = await contentApi.getAll(userId);
    return allContent.filter(c => c.gameId === gameId && c.category === categoryId);
  },
};
