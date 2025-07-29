import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download, Eye } from "lucide-react";

interface ContractPreviewProps {
  worker: any;
  contractType: 'cor' | 'eor' | 'direct';
  contractDetails: any;
  onComplete: (previewData: any) => void;
  onCancel: () => void;
}

export function ContractPreview({ 
  worker, 
  contractType, 
  contractDetails, 
  onComplete, 
  onCancel 
}: ContractPreviewProps) {
  const [previewData] = useState({
    documentId: `CONTRACT-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    templateVersion: '1.0'
  });

  const getContractTypeTitle = () => {
    switch (contractType) {
      case 'cor': return 'Contractor of Record (COR) Agreement';
      case 'eor': return 'Employer of Record (EOR) Agreement';
      case 'direct': return 'Direct Employment Agreement';
      default: return 'Employment Agreement';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const handleContinue = () => {
    onComplete(previewData);
  };

  // Generate mock contract content based on contract type and details
  const generateContractContent = () => {
    const today = new Date().toLocaleDateString();
    const startDate = contractDetails.start_date ? new Date(contractDetails.start_date).toLocaleDateString() : 'TBD';
    
    return `
EMPLOYMENT AGREEMENT

${getContractTypeTitle()}

This Agreement is entered into on ${today} between:

VIRGILIO TECHNOLOGIES INC. ("Virgilio")
Address: [Company Address]

AND

${contractDetails.legal_first_name} ${contractDetails.legal_last_name} ("Worker")
Address: ${contractDetails.country}${contractDetails.state_province ? ', ' + contractDetails.state_province : ''}

ARTICLE 1: ENGAGEMENT AND DUTIES

1.1 Position: ${contractDetails.job_title}
1.2 Seniority Level: ${contractDetails.seniority_level?.replace('_', ' ').toUpperCase()}
1.3 Employment Type: ${contractDetails.worker_type?.toUpperCase()}
1.4 Working Location: ${contractDetails.working_location || 'Remote'}

1.5 Scope of Work:
${contractDetails.scope_of_work || 'To be defined based on role requirements and company needs.'}

ARTICLE 2: COMPENSATION AND BENEFITS

2.1 Base Compensation: ${formatCurrency(contractDetails.base_salary, contractDetails.currency)} ${contractDetails.payment_period}
2.2 Currency: ${contractDetails.currency}
2.3 Payment Terms: ${contractDetails.employment_terms?.replace('_', ' ')}

${contractType === 'eor' ? `
2.4 Benefits: As an Employer of Record arrangement, Virgilio will provide:
- Health insurance coverage (where applicable)
- Statutory benefits as required by local law
- Vacation and sick leave entitlements
- Compliance with local employment standards
` : ''}

${contractType === 'cor' ? `
2.4 Contractor Benefits: As a Contractor of Record arrangement:
- Independent contractor status
- Virgilio handles payment processing and compliance
- No traditional employment benefits
- Tax obligations remain with contractor
` : ''}

ARTICLE 3: TERM AND TERMINATION

3.1 Start Date: ${startDate}
3.2 Contract Term: ${contractDetails.employment_term || 'Indefinite'}
${contractDetails.end_date ? `3.3 End Date: ${new Date(contractDetails.end_date).toLocaleDateString()}` : ''}

ARTICLE 4: VIRGILIO PLATFORM SERVICES

4.1 Virgilio acts as the ${contractType === 'eor' ? 'Employer of Record' : contractType === 'cor' ? 'Contractor of Record' : 'Platform Provider'}
4.2 Virgilio provides compliance management and payment processing services
4.3 All work is performed for and under the direction of the client organization

ARTICLE 5: CONFIDENTIALITY AND INTELLECTUAL PROPERTY

5.1 Confidentiality obligations apply to all proprietary information
5.2 Intellectual property created during employment belongs to the client organization
5.3 Non-disclosure terms continue beyond termination of this agreement

ARTICLE 6: GOVERNING LAW

This agreement is governed by the laws of the jurisdiction where services are primarily performed.

IN WITNESS WHEREOF, the parties have executed this Agreement.

VIRGILIO TECHNOLOGIES INC.

By: _________________________
Name: [Authorized Signatory]
Title: [Title]
Date: ${today}


WORKER

_________________________
${contractDetails.legal_first_name} ${contractDetails.legal_last_name}
Date: ________________

---
Document ID: ${previewData.documentId}
Generated: ${today}
Template Version: ${previewData.templateVersion}
    `;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Contract Preview</h3>
        <p className="text-muted-foreground">
          Review the generated contract document. You can download or print this preview before finalizing.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Contract Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Document Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => window.print()}
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => window.print()}
              >
                <Eye className="h-4 w-4 mr-2" />
                Print Preview
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium">{contractType.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Worker:</span>
                <span className="font-medium">{contractDetails.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Position:</span>
                <span className="font-medium">{contractDetails.job_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salary:</span>
                <span className="font-medium">
                  {formatCurrency(contractDetails.base_salary, contractDetails.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Document ID:</span>
                <span className="font-medium text-xs">{previewData.documentId}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contract Document */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {getContractTypeTitle()}
              </CardTitle>
              <CardDescription>
                Generated contract document ready for review and signature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
                  {generateContractContent()}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleContinue}>
          Continue to Final Review
        </Button>
      </div>
    </div>
  );
}