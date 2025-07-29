import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ContractPricingBreakdown } from "./ContractPricingBreakdown";
import { CheckCircle, FileText, User, Briefcase, DollarSign } from "lucide-react";

interface ContractFinalReviewProps {
  worker: any;
  contractType: 'cor' | 'eor' | 'direct';
  contractDetails: any;
  previewData: any;
  contractOptions: any[];
  onComplete: () => void;
  onCancel: () => void;
}

export function ContractFinalReview({ 
  worker, 
  contractType, 
  contractDetails, 
  previewData, 
  contractOptions,
  onComplete, 
  onCancel 
}: ContractFinalReviewProps) {
  const selectedOption = contractOptions.find(option => option.id === contractType);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const getContractTypeTitle = () => {
    switch (contractType) {
      case 'cor': return 'Contractor of Record (COR)';
      case 'eor': return 'Employer of Record (EOR)';
      case 'direct': return 'Direct Contract';
      default: return 'Contract';
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Final Review & Pricing</h3>
        <p className="text-muted-foreground">
          Review all contract details and Virgilio's service fees before generating the final contract.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Contract Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contract Summary
              </CardTitle>
              <CardDescription>
                Overview of the contract being generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{getContractTypeTitle()}</div>
                  <div className="text-sm text-muted-foreground">Contract Type Selected</div>
                </div>
              </div>
              
              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{contractDetails.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {contractDetails.legal_first_name} {contractDetails.legal_last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contractDetails.personal_email || contractDetails.work_email}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{contractDetails.job_title}</div>
                    <div className="text-sm text-muted-foreground">
                      {contractDetails.seniority_level?.replace('_', ' ')} • {contractDetails.employment_terms?.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contractDetails.working_location || 'Remote'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {formatCurrency(contractDetails.base_salary, contractDetails.currency)} {contractDetails.payment_period}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Base compensation in {contractDetails.currency}
                    </div>
                    {contractDetails.start_date && (
                      <div className="text-sm text-muted-foreground">
                        Starts: {new Date(contractDetails.start_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Document ID:</span>
                <span className="font-mono">{previewData.documentId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Generated:</span>
                <span>{new Date(previewData.generatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Template Version:</span>
                <span>{previewData.templateVersion}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Contract Type:</span>
                <span className="font-medium">{getContractTypeTitle()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Breakdown */}
        <div>
          <ContractPricingBreakdown 
            contractType={contractType}
            workerSalary={contractDetails.base_salary}
            currency={contractDetails.currency}
            paymentPeriod={contractDetails.payment_period}
            pricingOptions={selectedOption?.pricing}
          />
        </div>
      </div>

      {/* Final Actions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-primary">Ready to Generate Contract</CardTitle>
          <CardDescription>
            Once you generate the contract, it will be created in the system and you'll be able to download the final document.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onComplete} className="bg-primary hover:bg-primary/90">
              Generate Contract
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}