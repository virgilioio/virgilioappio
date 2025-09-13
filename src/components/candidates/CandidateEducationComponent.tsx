import { GraduationCap, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface CandidateEducationProps {
  education: CandidateEducation[];
}

export const CandidateEducationComponent = ({ education }: CandidateEducationProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).getFullYear();
  };

  if (education.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Education
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No education data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Education
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {education.map((edu, index) => (
          <div key={edu.id} className="relative">
            {index !== education.length - 1 && (
              <div className="absolute left-6 top-12 bottom-0 w-px bg-border" />
            )}
            
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <h3 className="font-semibold text-lg">{edu.institution_name}</h3>
                  {edu.degree_type && (
                    <p className="text-muted-foreground font-medium">
                      {edu.degree_type}
                      {edu.field_of_study && ` in ${edu.field_of_study}`}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  {(edu.start_date || edu.end_date) && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDate(edu.start_date)} - {formatDate(edu.end_date)}
                      </span>
                    </div>
                  )}
                  
                  {edu.grade && (
                    <Badge variant="outline" className="text-xs">
                      {edu.grade}
                    </Badge>
                  )}
                </div>
                
                {edu.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {edu.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};