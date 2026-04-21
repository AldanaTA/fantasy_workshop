import { getCurrentTokens } from './authStorage';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  lastAccessedAt: number;
};

type FetchWithCacheOptions = {
  ttlMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 100;

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function getScopeKey() {
  return getCurrentTokens()?.user_id ?? 'anonymous';
}

function scopedKey(key: string) {
  return `${getScopeKey()}:${key}`;
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function pruneExpiredEntries(now = Date.now()) {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function enforceMaxEntries() {
  if (cache.size <= MAX_ENTRIES) {
    return;
  }

  const entries = [...cache.entries()].sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
  const overflow = cache.size - MAX_ENTRIES;
  for (const [key] of entries.slice(0, overflow)) {
    cache.delete(key);
  }
}

function attachAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };

    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: FetchWithCacheOptions = {},
) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const fullKey = scopedKey(key);
  const now = Date.now();

  pruneExpiredEntries(now);

  const cachedEntry = cache.get(fullKey) as CacheEntry<T> | undefined;
  if (cachedEntry && cachedEntry.expiresAt > now) {
    cachedEntry.lastAccessedAt = now;
    return cloneValue(cachedEntry.value);
  }

  const existingRequest = inflight.get(fullKey) as Promise<T> | undefined;
  if (existingRequest) {
    return attachAbortSignal(existingRequest.then((value) => cloneValue(value)), options.signal);
  }

  const request = fetcher()
    .then((value) => {
      cache.set(fullKey, {
        value: cloneValue(value),
        expiresAt: Date.now() + ttlMs,
        lastAccessedAt: Date.now(),
      });
      enforceMaxEntries();
      return value;
    })
    .finally(() => {
      inflight.delete(fullKey);
    });

  inflight.set(fullKey, request);

  return attachAbortSignal(request.then((value) => cloneValue(value)), options.signal);
}

export function invalidateCacheKey(key: string) {
  const fullKey = scopedKey(key);
  cache.delete(fullKey);
  inflight.delete(fullKey);
}

export function invalidateCacheByPrefix(prefix: string) {
  const scopedPrefix = scopedKey(prefix);

  for (const key of cache.keys()) {
    if (key.startsWith(scopedPrefix)) {
      cache.delete(key);
    }
  }

  for (const key of inflight.keys()) {
    if (key.startsWith(scopedPrefix)) {
      inflight.delete(key);
    }
  }
}

export function clearRequestCache() {
  cache.clear();
  inflight.clear();
}
