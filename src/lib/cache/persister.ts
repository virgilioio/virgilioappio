import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/**
 * Bump CACHE_VERSION whenever cache shape changes (new query-key conventions,
 * breaking schema changes). Persisted entries with a different version are
 * discarded on boot.
 */
export const CACHE_VERSION = 'v1'
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
const NEVER_PERSIST_PREFIXES = ['auth', 'secret', 'chrome-extension', 'session']

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  if (typeof head !== 'string') return true
  return !NEVER_PERSIST_PREFIXES.includes(head)
}
