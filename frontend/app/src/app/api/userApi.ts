// Dummy User API
// In production, these would be real API calls to your backend

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
}

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const userApi = {
  login: async (credentials: LoginCredentials): Promise<User> => {
    await delay(800);
    
    // Dummy validation - accepts any email/password
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }
    
    return {
      id: 'user-' + Date.now(),
      email: credentials.email,
      name: credentials.email.split('@')[0],
    };
  },

  register: async (credentials: RegisterCredentials): Promise<User> => {
    await delay(800);
    
    if (!credentials.email || !credentials.password || !credentials.name) {
      throw new Error('All fields are required');
    }
    
    return {
      id: 'user-' + Date.now(),
      email: credentials.email,
      name: credentials.name,
    };
  },

  getCurrentUser: async (): Promise<User | null> => {
    await delay(300);
    
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  logout: async (): Promise<void> => {
    await delay(300);
    localStorage.removeItem('currentUser');
  },
};
