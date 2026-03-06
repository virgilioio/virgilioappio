import { Building2, MapPin, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

interface CandidateWorkExperienceProps {
  experiences: CandidateWorkExperience[];
}

export const CandidateWorkExperienceComponent = ({ experiences }: CandidateWorkExperienceProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const calculateTenure = (startDate?: string, endDate?: string) => {
    if (!startDate) return '';
    
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (months < 12) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    let result = `${years} year${years !== 1 ? 's' : ''}`;
    if (remainingMonths > 0) {
      result += ` ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    }
    
    return result;
  };

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
          <p className="text-muted-foreground">No work experience data available</p>
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
      <CardContent className="space-y-6">
        {experiences.map((exp, index) => (
          <div key={exp.id} className="relative">
            {index !== experiences.length - 1 && (
              <div className="absolute left-6 top-12 bottom-0 w-px bg-border" />
            )}
            
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                {exp.company_logo_url ? (
                  <img 
                    src={exp.company_logo_url} 
                    alt={`${exp.company_name} logo`}
                    className="w-12 h-12 rounded-lg object-contain bg-muted p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              
                <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{exp.job_title}</h3>
                      {exp.standardized_title && exp.standardized_title !== exp.job_title && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Sparkles className="h-3 w-3" />
                          {exp.standardized_title}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-muted-foreground font-medium">{exp.company_name}</p>
                      {exp.company_industry && (
                        <Badge variant="secondary" className="text-xs">{exp.company_industry}</Badge>
                      )}
                      {exp.company_size_category && (
                        <Badge variant="outline" className="text-xs capitalize">{exp.company_size_category}</Badge>
                      )}
                    </div>
                  </div>
                  {exp.is_current && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Current
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(exp.start_date)} - {exp.is_current ? 'Present' : formatDate(exp.end_date)}
                    </span>
                  </div>
                  
                  <div className="text-muted-foreground">
                    {calculateTenure(exp.start_date, exp.end_date)}
                  </div>
                  
                  {exp.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{exp.location}</span>
                    </div>
                  )}
                </div>
                
                {exp.description && (
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                    {exp.description}
                  </p>
                )}
                
                {exp.skills_used && exp.skills_used.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {exp.skills_used.map((skill, skillIndex) => (
                      <Badge key={skillIndex} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};