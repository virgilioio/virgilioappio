/**
 * Shared CORS utilities for Supabase Edge Functions
 * Dynamic single-origin echo with security headers
 */

export const ALLOWED_ORIGINS = [
  'https://app.virgilio.io',
  'https://auth.virgilio.io',
  'https://lovable.app',
  // Matches subdomains like https://preview--virgilioappio.lovable.app
  /https:\/\/[a-z0-9-]+\.lovable\.app$/,
  'http://localhost:5173',
];

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((item) =>
    typeof item === 'string' ? item === origin : item.test(origin)
  );
}

export function corsHeadersFor(origin?: string): Record<string, string> {
  const allow = isAllowedOrigin(origin) ? origin! : 'https://app.virgilio.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
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
