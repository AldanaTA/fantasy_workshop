import type { TokenPair } from './models';

export function setCurrent(tokens: TokenPair) {
  localStorage.setItem('currentTokens', JSON.stringify(tokens));
}
export function set_display_name(name: string) {
  localStorage.setItem('display_name', name);
}
export function set_email(email: string) {
  localStorage.setItem('email', email);
}

export function clearCurrent() {
  localStorage.removeItem('currentTokens');
  localStorage.removeItem('display_name');
  localStorage.removeItem('email');
}

export function getAccessToken(): string | null {

  const stored = localStorage.getItem('currentTokens');
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored) as TokenPair;
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

export function getCurrentTokens(): TokenPair | null {
  const stored = localStorage.getItem('currentTokens');
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored) as TokenPair;
    return parsed;
  } catch {
    return null;
  }
}

export function get_userId(): string {
  const stored = localStorage.getItem('currentTokens');
  if (!stored) {
    throw new Error('No current tokens stored.');
  }
  try {
    const parsed = JSON.parse(stored) as TokenPair;
    if (!parsed.user_id) {
      throw new Error('User ID missing from stored tokens.');
    }
    return parsed.user_id;
  } catch {
    throw new Error('Unable to parse current tokens.');
  }
}

export function get_display_name() {
  return localStorage.getItem('display_name');
}

export function get_email() {
  return localStorage.getItem('email');
}

export function get_refresh_token(): string | null {
  const stored = localStorage.getItem('currentTokens');
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored) as TokenPair;
    return parsed.refresh_token ?? null;
  } catch {
    return null;
  }
}