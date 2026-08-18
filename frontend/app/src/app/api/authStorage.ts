import type { TokenPair } from './models';

class AuthStore {
  private accessToken: string | null = null;
  private userId: string | null = null;

  private readonly DISPLAY_NAME_KEY = 'display_name';
  private readonly EMAIL_KEY = 'email';

  public setCurrent(tokens: TokenPair): void {
    this.accessToken = tokens.access_token;
    this.userId = tokens.user_id;
  }

  public clearCurrent(): void {
    this.accessToken = null;
    this.userId = null;

    localStorage.removeItem(this.DISPLAY_NAME_KEY);
    localStorage.removeItem(this.EMAIL_KEY);
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getUserId(): string {
    if (!this.userId) {
      throw new Error('No current user ID available.');
    }

    return this.userId;
  }

  public setDisplayName(name: string): void {
    localStorage.setItem(this.DISPLAY_NAME_KEY, name);
  }

  public getDisplayName(): string | null {
    return localStorage.getItem(this.DISPLAY_NAME_KEY);
  }

  public setEmail(email: string): void {
    localStorage.setItem(this.EMAIL_KEY, email);
  }

  public getEmail(): string | null {
    return localStorage.getItem(this.EMAIL_KEY);
  }

  public isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}

export const authStore = new AuthStore();