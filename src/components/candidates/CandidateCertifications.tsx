import { Award, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface CandidateCertification {
  id: string;
  certification_name: string;
  issuing_organization?: string;
  year_obtained?: number;
  is_bootcamp?: boolean;
}

interface CandidateCertificationsProps {
  certifications: CandidateCertification[];
}

export const CandidateCertificationsComponent = ({ certifications }: CandidateCertificationsProps) => {
  if (certifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No certifications data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Certifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {certifications.map((cert) => (
          <div key={cert.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Award className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-sm">{cert.certification_name}</h3>
                {cert.is_bootcamp && (
                  <Badge variant="secondary" className="text-xs">Bootcamp</Badge>
                )}
              </div>
              {cert.issuing_organization && (
                <p className="text-xs text-muted-foreground">{cert.issuing_organization}</p>
              )}
              {cert.year_obtained && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Calendar className="h-3 w-3" />
                  <span>{cert.year_obtained}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
