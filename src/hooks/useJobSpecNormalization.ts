import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface JobSpecs {
  title?: string;
  skills?: string[];
  location?: string;
}

interface NormalizedSpecs {
  standardized_title?: string;
  standardized_skills?: string[];
  standardized_location?: string;
  normalization_metadata: {
    title_mapping?: { original: string; canonical: string; synonyms_used?: string[] };
    skills_mapping?: Array<{ original: string; canonical: string; synonyms_used?: string[] }>;
    location_mapping?: { original: string; canonical: string; synonyms_used?: string[] };
    ai_variations_used?: boolean;
    fallback_used?: boolean;
    ai_variations?: any;
  };
}

export function useJobSpecNormalization() {
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeJobSpecs = useCallback(async (specs: JobSpecs): Promise<NormalizedSpecs | null> => {
    setIsNormalizing(true);
    setError(null);

    try {
      console.log('🔄 Normalizing job specs via edge function:', specs);

      const { data, error: functionError } = await supabase.functions.invoke(
        'normalize-job-specs',
        {
          body: { specs }
        }
      );

      if (functionError) {
        console.error('❌ Normalization function error:', functionError);
        setError(functionError.message);
        return null;
      }

      if (!data?.normalized) {
        console.error('❌ Invalid normalization response:', data);
        setError('Invalid response from normalization service');
        return null;
      }

      console.log('✅ Normalization successful:', data.normalized);
      return data.normalized;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Normalization failed';
      console.error('❌ Normalization error:', err);
      setError(errorMessage);
      return null;
    } finally {
      setIsNormalizing(false);
    }
  }, [setIsNormalizing, setError]);

  const generateQueryVariations = useCallback(async (specs: JobSpecs): Promise<any> => {
    try {
      console.log('🤖 Generating query variations:', specs);

      const { data, error: functionError } = await supabase.functions.invoke(
        'normalize-job-specs',
        {
          body: { 
            specs,
            generateVariationsOnly: true 
          }
        }
      );

      if (functionError) {
        console.warn('⚠️ Query variations generation failed:', functionError);
        return {};
      }

      return data?.normalized?.normalization_metadata?.ai_variations || {};
    } catch (err) {
      console.warn('⚠️ Query variations error:', err);
      return {};
    }
  }, []);

  return {
    normalizeJobSpecs,
    generateQueryVariations,
    isNormalizing,
    error
  };
}