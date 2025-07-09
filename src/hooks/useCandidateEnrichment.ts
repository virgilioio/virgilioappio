import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CandidateWorkExperience {
  id: string;
  company_name: string;
  company_logo_url?: string;
  job_title: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
  skills_used?: string[];
  location?: string;
}

export interface CandidateEducation {
  id: string;
  institution_name: string;
  degree_type?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  description?: string;
}

export interface EnrichmentLog {
  id: string;
  enrichment_type: string;
  status: string;
  credits_used: number;
  data_found: any;
  error_message?: string;
  created_at: string;
}

export const useCandidateEnrichment = () => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [workExperience, setWorkExperience] = useState<CandidateWorkExperience[]>([]);
  const [education, setEducation] = useState<CandidateEducation[]>([]);
  const [enrichmentLogs, setEnrichmentLogs] = useState<EnrichmentLog[]>([]);
  const { toast } = useToast();

  const enrichCandidate = async (candidateId: string, searchQuery?: any) => {
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('coresignal-person-enrichment', {
        body: { candidateId, searchQuery }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Enrichment Complete",
          description: data.message,
        });
        
        // Refresh the enriched data
        await fetchCandidateEnrichmentData(candidateId);
      } else {
        toast({
          title: "Enrichment Failed",
          description: data.message,
          variant: "destructive",
        });
      }

      return data;
    } catch (error) {
      console.error('Enrichment error:', error);
      toast({
        title: "Enrichment Error",
        description: "Failed to enrich candidate profile",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsEnriching(false);
    }
  };

  const fetchCandidateEnrichmentData = async (candidateId: string) => {
    try {
      // Fetch work experience
      const { data: workExp, error: workError } = await supabase
        .from('candidate_work_experience')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('start_date', { ascending: false });

      if (workError) throw workError;
      setWorkExperience(workExp || []);

      // Fetch education
      const { data: edu, error: eduError } = await supabase
        .from('candidate_education')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('start_date', { ascending: false });

      if (eduError) throw eduError;
      setEducation(edu || []);

      // Fetch enrichment logs
      const { data: logs, error: logsError } = await supabase
        .from('candidate_enrichment_logs')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;
      setEnrichmentLogs(logs || []);

    } catch (error) {
      console.error('Error fetching enrichment data:', error);
      toast({
        title: "Data Fetch Error",
        description: "Failed to load enrichment data",
        variant: "destructive",
      });
    }
  };

  const generateResume = async (candidateId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-candidate-resume', {
        body: { candidateId }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Resume Generated",
          description: "Professional resume created successfully",
        });
        return data.resume_url;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Resume generation error:', error);
      toast({
        title: "Resume Generation Failed",
        description: "Failed to generate professional resume",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    isEnriching,
    workExperience,
    education,
    enrichmentLogs,
    enrichCandidate,
    fetchCandidateEnrichmentData,
    generateResume,
  };
};