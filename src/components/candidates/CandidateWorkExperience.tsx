import { ExperienceTimeline } from '@/components/candidates/experience/ExperienceTimeline'

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
  standardized_title?: string;
  company_industry?: string;
  company_size_category?: string;
  duration_months?: number;
  company_id?: string;
  start_precision?: 'month' | 'year';
}

interface CandidateWorkExperienceProps {
  experiences: CandidateWorkExperience[];
}

export const CandidateWorkExperienceComponent = ({ experiences }: CandidateWorkExperienceProps) => {
  return <ExperienceTimeline items={experiences} />;
};