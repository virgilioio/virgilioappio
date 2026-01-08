/**
 * Contextual Booking Link Utilities
 * Handles encoding/decoding of job+candidate+stage context in booking URLs
 * Supports both short tokens (new) and base64 encoded context (legacy)
 */

import { supabase } from '@/lib/supabaseClient';

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
 * Encode booking context to a URL-safe base64 string (legacy method)
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
 * Decode booking context from a URL-safe base64 string (legacy method)
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
 * Generate a contextual booking link with job+candidate+stage context (legacy base64)
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
 * Create a short booking token via the edge function
 */
export async function createShortBookingToken(params: {
  shortCode: string;
  context: BookingContext;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('create-booking-token', {
      body: {
        job_id: params.context.jobId,
        candidate_id: params.context.candidateId,
        jhs_id: params.context.jhsId,
        association_id: params.context.associationId,
        candidate_name: params.context.candidateName,
        candidate_email: params.context.candidateEmail,
        job_title: params.context.jobTitle,
        stage_name: params.context.stageName,
        short_code: params.shortCode,
      },
    });

    if (error) {
      console.error('Failed to create booking token:', error);
      return null;
    }

    return data?.token || null;
  } catch (e) {
    console.error('Failed to create booking token:', e);
    return null;
  }
}

/**
 * Generate a short contextual booking link
 */
export function generateShortBookingLink(params: {
  shortCode: string;
  token: string;
  baseUrl?: string;
}): string {
  const { shortCode, token, baseUrl = window.location.origin } = params;
  return `${baseUrl}/schedule/${shortCode}?t=${token}`;
}

/**
 * Resolve a short token to booking context via the edge function
 */
export async function resolveBookingToken(token: string): Promise<BookingContext | null> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL || 'https://etrxjxstjfcozdjumfsj.supabase.co'}/functions/v1/resolve-booking-token?token=${encodeURIComponent(token)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to resolve booking token:', response.status);
      return null;
    }

    const data = await response.json();
    return data?.context || null;
  } catch (e) {
    console.error('Failed to resolve booking token:', e);
    return null;
  }
}

/**
 * Parse booking context from URL search params
 * Supports both short tokens (?t=) and legacy base64 (?ctx=)
 */
export function parseBookingContextFromUrl(searchParams: URLSearchParams): BookingContext | null {
  // Legacy base64 context
  const ctx = searchParams.get('ctx');
  if (ctx) {
    return decodeBookingContext(ctx);
  }
  
  // Note: Short token resolution is async and must be done separately
  return null;
}

/**
 * Check if URL has a short token that needs async resolution
 */
export function hasShortToken(searchParams: URLSearchParams): boolean {
  return !!searchParams.get('t');
}

/**
 * Get the short token from URL params
 */
export function getShortToken(searchParams: URLSearchParams): string | null {
  return searchParams.get('t');
}
