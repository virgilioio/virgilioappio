import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDefaultBoolean, type JobForBoolean } from '@/lib/booleanQuery';

export interface SourcingQuery {
  boolean?: string;
  titles?: string[];
  keywords?: string[];
  locations?: string[];
  languages?: string[];
  seniority?: string[];
  has_email?: 'only' | 'any';
  has_phone?: 'only' | 'any';
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
      const body = {
        organization_id: request.organization_id,
        job_id: request.job_id ?? null,
        query: {
          boolean: (request.query?.boolean || buildDefaultBoolean(request.jobSpec || {})).trim(),
          locations: request.query?.locations ?? [],
          seniority: request.query?.seniority ?? [],
          languages: request.query?.languages ?? [],
          require_email: !!request.query?.has_email,
          require_phone: !!request.query?.has_phone,
          updated_within_days: request.query?.updated_within_days ?? null
        },
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to search candidates';
      setError(errorMessage);
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
