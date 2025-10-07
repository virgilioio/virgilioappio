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

export function createSecureCorsHeaders(options: SecureCorsOptions = {}, req?: Request) {
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
  
  // Get the actual request origin
  const requestOrigin = req?.headers.get('Origin') || ''
  
  // Check if the request origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      // Handle wildcard patterns like https://*.lovable.app
      const pattern = allowed.replace(/\*/g, '[^.]+').replace(/\./g, '\\.')
      return new RegExp(`^${pattern}$`).test(requestOrigin)
    }
    return allowed === requestOrigin
  })
  
  // Return the specific origin if allowed, otherwise fallback appropriately
  const origin = isAllowed 
    ? requestOrigin 
    : (isProduction ? 'https://app.virgilio.io' : '*')

  console.log(`[CORS] Environment: ${environment}, Production: ${isProduction}, Request Origin: ${requestOrigin}, Allowed: ${isAllowed}, Returning: ${origin}`)

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
