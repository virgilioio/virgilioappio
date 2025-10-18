import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDefaultBoolean, type JobForBoolean } from '@/lib/booleanQuery';

type EdgeErrorDetails = {
  message?: string;
  code?: string | number;
  payload?: unknown;
};

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function extractEdgeErrorDetails(error: unknown): Promise<EdgeErrorDetails | null> {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const context = (error as { context?: Record<string, unknown> }).context;
  const response = context && 'response' in context ? (context.response as any) : undefined;

  let payload: unknown;

  if (response) {
    const maybeResponse = typeof response.clone === 'function' ? response.clone() : response;

    try {
      if (typeof maybeResponse.json === 'function') {
        payload = await maybeResponse.json();
      } else if (typeof maybeResponse.text === 'function') {
        const text = await maybeResponse.text();
        payload = safeParseJson(text) ?? text;
      } else if ('data' in maybeResponse) {
        payload = (maybeResponse as { data?: unknown }).data;
      }
    } catch (parseError) {
      if (import.meta.env.DEV) {
        console.debug('[sourcing-search] failed to parse edge error response', parseError);
      }
    }
  }

  if (!payload && context && 'error' in context) {
    payload = (context as { error?: unknown }).error;
  }

  if (!payload && context && 'data' in context) {
    payload = (context as { data?: unknown }).data;
  }

  if (!payload) {
    return null;
  }

  let message: string | undefined;
  let code: string | number | undefined;

  if (typeof payload === 'string') {
    message = payload;
  } else if (typeof payload === 'object' && payload !== null) {
    const payloadRecord = payload as Record<string, unknown>;
    const potentialMessage =
      payloadRecord.message ?? payloadRecord.error ?? payloadRecord.msg ?? payloadRecord.description;

    if (typeof potentialMessage === 'string') {
      message = potentialMessage;
    }

    const potentialCode =
      payloadRecord.code ??
      payloadRecord.status ??
      payloadRecord.error_code ??
      payloadRecord.errorCode ??
      payloadRecord.type;

    if (typeof potentialCode === 'string' || typeof potentialCode === 'number') {
      code = potentialCode;
    }
  }

  return {
    message,
    code,
    payload,
  };
}

/**
 * Sanitizes a query object by removing null, undefined, empty strings, and empty arrays.
 */
export function sanitizeQuery(query: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(query)) {
    // Skip null, undefined, empty string, or empty array
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    sanitized[key] = value;
  }
  
  return sanitized;
}

export interface SourcingQuery {
  boolean?: string;
  titles?: string[];
  keywords?: string[];
  locations?: string[];
  languages?: string[];
  seniority?: string[];
  updated_within_days?: number;
}

export interface SourcingSearchRequest {
  organization_id: string;
  job_id?: string;
  query: SourcingQuery;
  pagination?: {
    page: number;
    pageSize: number;
  };
  jobSpec?: JobForBoolean;
}

export interface SearchResultItem {
  provider_code: 'coresignal';
  provider_ref: string;
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  profileUrl?: string;
  lastUpdatedAt?: string;
  match: number;
}

export interface SourcingSearchResponse {
  total: number;
  items: SearchResultItem[];
  cache: {
    hit: boolean;
    ttl_seconds: number;
  };
  credits: {
    charged: number;
    remaining?: number;
  };
}

export function useExternalSourcing() {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ hit: boolean; ttl_seconds: number } | null>(null);
  const [creditsInfo, setCreditsInfo] = useState<{ charged: number; remaining?: number } | null>(null);

  const runSearch = async (request: SourcingSearchRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      // Build the query with sanitization (remove unsupported fields)
      const rawQuery = {
        boolean: (request.query?.boolean || buildDefaultBoolean(request.jobSpec || {})).trim(),
        titles: request.query?.titles,
        keywords: request.query?.keywords,
        locations: request.query?.locations,
        seniority: request.query?.seniority,
        languages: request.query?.languages,
        updated_within_days: request.query?.updated_within_days
      };

      const body = {
        organization_id: request.organization_id,
        job_id: request.job_id,
        query: sanitizeQuery(rawQuery),
        pagination: {
          page: request.pagination?.page ?? 1,
          pageSize: request.pagination?.pageSize ?? 25
        }
      };

      if (import.meta.env.DEV) {
        console.debug('[sourcing-search] request', body);
      }

      const { data, error: invocationError } = await supabase.functions.invoke<SourcingSearchResponse>(
        'sourcing-search',
        {
          body,
        }
      );

      if (invocationError) {
        throw invocationError;
      }

      if (!data) {
        throw new Error('No data returned from search');
      }

      setResults(data.items);
      setTotal(data.total);
      setCacheInfo(data.cache);
      setCreditsInfo(data.credits);
    } catch (err) {
      const defaultMessage = err instanceof Error && err.message ? err.message : 'Failed to search candidates';
      const edgeErrorDetails = await extractEdgeErrorDetails(err);

      if (import.meta.env.DEV && edgeErrorDetails?.payload) {
        console.debug('[sourcing-search] edge function error payload', edgeErrorDetails.payload);
      }

      let finalMessage = edgeErrorDetails?.message ?? defaultMessage;

      if (!finalMessage) {
        finalMessage = 'Failed to search candidates';
      }

      if (edgeErrorDetails?.code !== undefined) {
        finalMessage = `${finalMessage} (${edgeErrorDetails.code})`;
      }

      setError(finalMessage);
      console.error('External sourcing error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResults([]);
    setTotal(0);
    setError(null);
    setCacheInfo(null);
    setCreditsInfo(null);
  };

  return {
    results,
    total,
    isLoading,
    error,
    cacheInfo,
    creditsInfo,
    runSearch,
    reset,
  };
}
