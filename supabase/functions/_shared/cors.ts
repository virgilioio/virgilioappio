/**
 * Shared CORS utilities for Supabase Edge Functions
 * Dynamic single-origin echo with hostname-based allowlist
 */

const ALLOWED_HOSTNAMES = new Set([
  'app.virgilio.io',
  'auth.virgilio.io',
  'lovable.app',
  'localhost',
]);

export function isAllowedOrigin(origin?: string): { allowed: boolean; host?: string } {
  if (!origin) return { allowed: false };
  
  try {
    const url = new URL(origin);
    const host = url.hostname;
    
    // Check exact hostname match
    if (ALLOWED_HOSTNAMES.has(host)) {
      return { allowed: true, host };
    }
    
    // Check if hostname ends with .lovable.app (for preview domains)
    if (host.endsWith('.lovable.app')) {
      return { allowed: true, host };
    }
    
    // Check if hostname ends with .lovableproject.com (for preview domains)
    if (host.endsWith('.lovableproject.com')) {
      return { allowed: true, host };
    }
    
    return { allowed: false, host };
  } catch {
    return { allowed: false };
  }
}

export function corsHeadersFor(origin?: string): Record<string, string> {
  const { allowed } = isAllowedOrigin(origin);
  const allow = allowed && origin ? origin : 'https://app.virgilio.io';
  
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
    return new Response('ok', { headers: corsHeadersFor(origin) });
  }
  return null;
}

// Legacy exports for backward compatibility
export const createSecureCorsHeaders = () => corsHeadersFor();
export const handleSecureCorsPreFlight = (req: Request, _corsHeaders?: Record<string, string>) => handlePreflight(req);
