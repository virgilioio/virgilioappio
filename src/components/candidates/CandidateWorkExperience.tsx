import { Building2 } from "lucide-react";
import { InlineEmpty } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (experiences.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Work Experience
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InlineEmpty text="No work experience data available." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Work Experience
        </CardTitle>
      </CardHeader>
      <CardContent><ExperienceTimeline items={experiences} /></CardContent>
    </Card>
  );
};