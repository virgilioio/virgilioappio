import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Zap, CheckCircle, Clock, AlertCircle, Download, Search, Mail, Building2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCandidateEnrichment, EnrichmentLog } from "@/hooks/useCandidateEnrichment";
import { IndependentCandidate } from "@/hooks/useIndependentCandidates";

interface EnrichmentPanelProps {
  candidate: IndependentCandidate;
  onEnrichmentComplete?: () => void;
}

export const EnrichmentPanel = ({ candidate, onEnrichmentComplete }: EnrichmentPanelProps) => {
  const [isEnrichDialogOpen, setIsEnrichDialogOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState(candidate.email || '');
  const [searchLinkedIn, setSearchLinkedIn] = useState(candidate.linkedin_url || '');
  const [searchCompany, setSearchCompany] = useState(candidate.company_current || '');

  const {
    isEnriching,
    enrichmentLogs,
    enrichCandidate,
    fetchCandidateEnrichmentData,
    generateResume
  } = useCandidateEnrichment();

  const getEnrichmentStatus = () => {
    if (candidate.enrichment_status === 'enriched') {
      return {
        status: 'enriched',
        icon: CheckCircle,
        text: 'Enriched',
        color: 'bg-green-100 text-green-800'
      };
    }
    if (candidate.enrichment_status === 'failed') {
      return {
        status: 'failed',
        icon: AlertCircle,
        text: 'Failed',
        color: 'bg-red-100 text-red-800'
      };
    }
    return {
      status: 'pending',
      icon: Clock,
      text: 'Pending',
      color: 'bg-yellow-100 text-yellow-800'
    };
  };

  const handleEnrichment = async () => {
    try {
      const searchQuery = {
        email: searchEmail || undefined,
        linkedin_url: searchLinkedIn || undefined,
        full_name: candidate.candidate_name,
        company: searchCompany || undefined
      };

      await enrichCandidate(candidate.id, searchQuery);
      setIsEnrichDialogOpen(false);
      onEnrichmentComplete?.();
    } catch (error) {
      console.error('Enrichment failed:', error);
    }
  };

  const handleGenerateResume = async () => {
    try {
      const resumeUrl = await generateResume(candidate.id);
      if (resumeUrl) {
        window.open(resumeUrl, '_blank');
      }
    } catch (error) {
      console.error('Resume generation failed:', error);
    }
  };

  const statusInfo = getEnrichmentStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          CoreSignal Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enrichment Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-4 w-4" />
            <span className="text-sm">Enrichment Status</span>
          </div>
          <Badge className={statusInfo.color}>
            {statusInfo.text}
          </Badge>
        </div>

        {candidate.enriched_at && (
          <div className="text-xs text-muted-foreground">
            Last enriched: {new Date(candidate.enriched_at).toLocaleDateString()}
          </div>
        )}

        {/* Quick Stats */}
        {candidate.enrichment_status === 'enriched' && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {candidate.contact_emails && candidate.contact_emails.length > 0 && (
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span>{candidate.contact_emails.length} email{candidate.contact_emails.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {candidate.years_experience && (
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span>{candidate.years_experience} years exp.</span>
              </div>
            )}
            {candidate.company_current && (
              <div className="flex items-center gap-1 col-span-2">
                <User className="h-3 w-3" />
                <span className="truncate">{candidate.role_current} at {candidate.company_current}</span>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-2">
          <Dialog open={isEnrichDialogOpen} onOpenChange={setIsEnrichDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                disabled={isEnriching}
              >
                <Search className="h-4 w-4" />
                {candidate.enrichment_status === 'enriched' ? 'Re-enrich Profile' : 'Enrich Profile'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Enrich Candidate Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  CoreSignal will search for comprehensive professional data including work experience, education, and verified contact information.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="search-email">Email (optional)</Label>
                    <Input
                      id="search-email"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      placeholder="candidate@email.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="search-linkedin">LinkedIn URL (optional)</Label>
                    <Input
                      id="search-linkedin"
                      value={searchLinkedIn}
                      onChange={(e) => setSearchLinkedIn(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="search-company">Current Company (optional)</Label>
                    <Input
                      id="search-company"
                      value={searchCompany}
                      onChange={(e) => setSearchCompany(e.target.value)}
                      placeholder="Company name"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleEnrichment}
                    disabled={isEnriching}
                    className="flex-1"
                  >
                    {isEnriching ? 'Enriching...' : 'Start Enrichment'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEnrichDialogOpen(false)}
                    disabled={isEnriching}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {candidate.enrichment_status === 'enriched' && (
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={handleGenerateResume}
            >
              <Download className="h-4 w-4" />
              Generate Resume
            </Button>
          )}
        </div>

        {/* Recent Enrichment Logs */}
        {enrichmentLogs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recent Activity</h4>
              {enrichmentLogs.slice(0, 3).map((log: EnrichmentLog) => (
                <div key={log.id} className="text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span className="capitalize">{log.enrichment_type}</span>
                    <span className={log.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {log.status}
                    </span>
                  </div>
                  <div>{new Date(log.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};