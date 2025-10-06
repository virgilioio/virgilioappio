/**
 * Safe localStorage cache for organization context
 * Binds to user ID to prevent cross-user contamination
 */

const CACHE_KEY = 'virgilio_org_context';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface OrgContextCache {
  userId: string;
  organizationId: string | null;
  role: string | null;
  userType: string | null;
  updatedAt: number;
}

/**
 * Read org context from cache, validating user ID and TTL
 */
export function readOrgCache(currentUserId: string): OrgContextCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cache: OrgContextCache = JSON.parse(raw);
    
    // Validate user ID matches
    if (cache.userId !== currentUserId) {
      clearOrgCache();
      return null;
    }

    // Validate TTL
    const age = Date.now() - cache.updatedAt;
    if (age > CACHE_TTL_MS) {
      clearOrgCache();
      return null;
    }

    return cache;
  } catch (error) {
    console.error('Failed to read org cache:', error);
    clearOrgCache();
    return null;
  }
}

/**
 * Write org context to cache
 */
export function writeOrgCache(
  userId: string,
  organizationId: string | null,
  role: string | null,
  userType: string | null
): void {
  try {
    const cache: OrgContextCache = {
      userId,
      organizationId,
      role,
      userType,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to write org cache:', error);
  }
}

/**
 * Clear org context cache
 */
export function clearOrgCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear org cache:', error);
  }
}
