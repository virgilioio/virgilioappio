import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnrichmentLog {
  id: string;
  enrichment_type: string;
  terms_added: number | null;
  synonyms_added: number | null;
  additions_made: any;
  candidates_analyzed: number | null;
  processing_time_ms: number | null;
  created_at: string;
}

export function useLibraryEnrichment() {
  const [recentEnrichments, setRecentEnrichments] = useState<EnrichmentLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentEnrichments = async (limit = 10) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('library_enrichment_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw fetchError;
      }

      setRecentEnrichments(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch enrichment logs';
      setError(errorMessage);
      console.error('Error fetching enrichment logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getEnrichmentSummary = () => {
    if (recentEnrichments.length === 0) return null;

    const last24Hours = recentEnrichments.filter(log => {
      const logDate = new Date(log.created_at);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return logDate > yesterday;
    });

    const totalTermsAdded = last24Hours.reduce((sum, log) => sum + (log.terms_added || 0), 0);
    const totalSynonymsAdded = last24Hours.reduce((sum, log) => sum + (log.synonyms_added || 0), 0);
    const totalCandidatesAnalyzed = last24Hours.reduce((sum, log) => sum + (log.candidates_analyzed || 0), 0);

    return {
      enrichmentsCount: last24Hours.length,
      totalTermsAdded,
      totalSynonymsAdded,
      totalCandidatesAnalyzed,
      averageProcessingTime: last24Hours.length > 0 
        ? Math.round(last24Hours.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0) / last24Hours.length)
        : 0
    };
  };

  const getRecentlyAddedTerms = () => {
    const recentAdditions: Array<{
      type: string;
      canonical: string;
      synonym?: string;
      confidence: number;
      addedAt: string;
    }> = [];

    recentEnrichments.forEach(log => {
      if (log.additions_made && Array.isArray(log.additions_made)) {
        log.additions_made.forEach(addition => {
          recentAdditions.push({
            ...addition,
            addedAt: log.created_at
          });
        });
      }
    });

    return recentAdditions.slice(0, 20); // Latest 20 additions
  };

  useEffect(() => {
    fetchRecentEnrichments();
  }, []);

  return {
    recentEnrichments,
    isLoading,
    error,
    fetchRecentEnrichments,
    getEnrichmentSummary,
    getRecentlyAddedTerms
  };
}