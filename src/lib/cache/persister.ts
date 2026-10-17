import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/**
 * Bump CACHE_VERSION whenever cache shape changes (new query-key conventions,
 * breaking schema changes). Persisted entries with a different version are
 * discarded on boot.
 */
// v2 (2026-10-14): v1 caches could hold Maps saved as plain objects.
export const CACHE_VERSION = 'v2'
const STORAGE_KEY = `virgilio.rq-cache.${CACHE_VERSION}`

// localStorage can be missing (SSR, privacy mode, iframes).
const safeStorage: Storage | undefined = (() => {
  try {
    if (typeof window === 'undefined') return undefined
    const probe = '__rq_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return undefined
  }
})()

// Older cache versions are dead weight in localStorage.
try {
  safeStorage?.removeItem('virgilio.rq-cache.v1')
} catch {
  /* ignore */
}

const syncPersister = safeStorage
  ? createSyncStoragePersister({
      storage: safeStorage,
      key: STORAGE_KEY,
      throttleTime: 1000,
    })
  : null

/**
 * Wrap the persister so we can also wipe it on sign-out / tenant switch.
 */
export const persister: Persister = {
  persistClient: async (client: PersistedClient) => {
    if (!syncPersister) return
    await syncPersister.persistClient(client)
  },
  restoreClient: async () => {
    if (!syncPersister) return undefined
    return syncPersister.restoreClient()
  },
  removeClient: async () => {
    if (!syncPersister) return
    await syncPersister.removeClient()
  },
}

export function clearPersistedCache(queryClient?: QueryClient) {
  try {
    safeStorage?.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  queryClient?.clear()
}

/**
 * Sensitive query keys we never persist to localStorage.
 * Anything in this list still benefits from the in-memory cache.
 */
const NEVER_PERSIST_PREFIXES = [
  'auth', 'secret', 'chrome-extension', 'session',
  // Whole candidate lists: too big for the browser's 5 MB storage, and
  // personal data that shouldn't sit on the device (2026-10-17).
  'independent-candidates', 'candidate-associations-map',
]

/**
 * Lists too long to save. The whole cache is saved as one value of at most
 * ~5 MB, written about once a second; one long list made every write fail and
 * re-serialise megabytes on the main thread (2026-10-17).
 */
export function isLargeForStorage(data: unknown): boolean {
  if (Array.isArray(data)) return data.length > 300
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length > 300) return true
    }
  }
  return false
}

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  if (typeof head !== 'string') return true
  return !NEVER_PERSIST_PREFIXES.includes(head)
}
