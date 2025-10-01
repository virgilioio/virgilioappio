/**
 * Utility to create edge functions with improved CORS configuration
 * Restricts origins based on environment and adds security headers
 * 
 * Note: This utility is designed for Supabase Edge Functions
 * For client-side usage, remove Deno-specific code
 */

interface SecureCorsOptions {
  allowedOrigins?: string[]
  allowCredentials?: boolean
  maxAge?: number
  environment?: string
}

export function createSecureCorsHeaders(options: SecureCorsOptions = {}) {
  const {
    allowedOrigins = [
      'https://app.virgilio.io',
      'https://auth.virgilio.io',
      'https://lovable.app',
      'https://*.lovable.app',
      'http://localhost:5173'
    ],
    allowCredentials = true,
    maxAge = 86400, // 24 hours
    environment = Deno.env.get('ENVIRONMENT') || 'development'
  } = options

  // Detect environment based on request origin or env variable
  const isProduction = environment === 'production' || 
                       Deno.env.get('SUPABASE_URL')?.includes('supabase.co')
  
  // For production, restrict to known domains
  // For development, allow localhost and preview URLs
  const origin = isProduction 
    ? allowedOrigins.filter(o => !o.includes('localhost')).join(', ')
    : '*' // Allow all origins in development for easier testing

  console.log(`[CORS] Environment: ${environment}, Production: ${isProduction}, Origin: ${origin}`)

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': allowCredentials.toString(),
    'Access-Control-Max-Age': maxAge.toString(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
}

export function handleSecureCorsPreFlight(req: Request, corsHeaders: Record<string, string>) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    })
  }
  return null
}