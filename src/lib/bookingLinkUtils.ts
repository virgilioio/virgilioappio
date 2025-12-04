/**
 * Contextual Booking Link Utilities
 * Handles encoding/decoding of job+candidate+stage context in booking URLs
 */

export interface BookingContext {
  jobId: string;
  candidateId: string;
  jhsId: string; // job_hiring_stage_id
  associationId: string;
  candidateName?: string;
  candidateEmail?: string;
  jobTitle?: string;
  stageName?: string;
}

/**
 * Encode booking context to a URL-safe base64 string
 */
export function encodeBookingContext(context: BookingContext): string {
  try {
    const json = JSON.stringify(context);
    // Use base64url encoding (URL-safe)
    return btoa(json)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    console.error('Failed to encode booking context:', e);
    return '';
  }
}

/**
 * Decode booking context from a URL-safe base64 string
 */
export function decodeBookingContext(encoded: string): BookingContext | null {
  try {
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = atob(base64);
    const context = JSON.parse(json) as BookingContext;
    
    // Validate required fields
    if (!context.jobId || !context.candidateId || !context.jhsId || !context.associationId) {
      console.warn('Invalid booking context: missing required fields');
      return null;
    }
    
    return context;
  } catch (e) {
    console.error('Failed to decode booking context:', e);
    return null;
  }
}

/**
 * Generate a contextual booking link with job+candidate+stage context
 */
export function generateContextualBookingLink(params: {
  shortCode: string;
  context: BookingContext;
  baseUrl?: string;
}): string {
  const { shortCode, context, baseUrl = window.location.origin } = params;
  const encodedContext = encodeBookingContext(context);
  
  if (!encodedContext) {
    // Fallback to generic booking link
    return `${baseUrl}/schedule/${shortCode}`;
  }
  
  return `${baseUrl}/schedule/${shortCode}?ctx=${encodedContext}`;
}

/**
 * Parse booking context from URL search params
 */
export function parseBookingContextFromUrl(searchParams: URLSearchParams): BookingContext | null {
  const ctx = searchParams.get('ctx');
  if (!ctx) return null;
  return decodeBookingContext(ctx);
}
