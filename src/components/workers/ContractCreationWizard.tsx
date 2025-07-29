import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Building, UserCheck, ChevronDown, ChevronUp } from "lucide-react";
import { ContractDetailsReview } from "./ContractDetailsReview";
import { ContractPreview } from "./ContractPreview";
import { ContractFinalReview } from "./ContractFinalReview";

interface ContractCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: any;
  contract: any;
  onComplete: (contractType: string) => void;
}

type ContractType = 'cor' | 'eor' | 'direct';

interface ContractOption {
  id: ContractType;
  title: string;
  description: string;
  icon: typeof FileText;
  features: string[];
  pricing: {
    monthlyFee?: number;
    percentageFee?: number;
    thresholdAmount?: number;
    setupFee: string;
    description: string;
  };
}

const contractOptions: ContractOption[] = [
  {
    id: 'cor',
    title: 'Virgilio COR Contract',
    description: 'A contract where Virgilio acts as the Contractor of Record, managing payments and compliance for independent contractors hired globally.',
    icon: Building,
    features: [
      'Global compliance management',
      'Payment processing',
      'Independent contractor setup',
      'Multi-currency support'
    ],
    pricing: {
      monthlyFee: 189,
      percentageFee: 12.5,
      thresholdAmount: 1500,
      setupFee: "One month in advance + current pay cycle amount",
      description: "$189/month or 12.5% of contractor payments for salaries above $1,500 USD monthly"
    }
  },
  {
    id: 'eor',
    title: 'Virgilio EOR Contract',
    description: 'A contract where Virgilio serves as the Employer of Record, handling payroll, benefits, and legal compliance for full-time employees across borders.',
    icon: UserCheck,
    features: [
      'Full employment compliance',
      'Benefits administration',
      'Payroll management',
      'Cross-border legal handling'
    ],
    pricing: {
      monthlyFee: 399,
      setupFee: "One month in advance + current pay cycle amount",
      description: "$399 per month per employee"
    }
  },
  {
    id: 'direct',
    title: 'Direct Contract',
    description: 'A customizable contract for direct hiring, enabling clients to manage their own employment agreements using Virgilio\'s platform.',
    icon: FileText,
    features: [
      'Customizable terms',
      'Direct employment',
      'Platform management tools',
      'Self-service setup'
    ],
    pricing: {
      monthlyFee: 50,
      setupFee: "One month in advance + current pay cycle amount",
      description: "$50 USD per month per worker flat"
    }
  }
];

interface WizardData {
  contractType?: ContractType;
  contractDetails?: any;
  previewData?: any;
}

export function ContractCreationWizard({ 
  open, 
  onOpenChange, 
  worker, 
  contract, 
  onComplete 
}: ContractCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [expandedFeatures, setExpandedFeatures] = useState<string | null>(null);
  const [expandedPricing, setExpandedPricing] = useState<string | null>(null);

  const handleContractTypeSelect = (contractType: ContractType) => {
    setWizardData(prev => ({ ...prev, contractType }));
    setCurrentStep(2);
  };

  const handleContractDetailsComplete = (details: any) => {
    setWizardData(prev => ({ ...prev, contractDetails: details }));
    setCurrentStep(3);
  };

  const handlePreviewComplete = (previewData: any) => {
    setWizardData(prev => ({ ...prev, previewData }));
    setCurrentStep(4);
  };

  const handleFinalComplete = () => {
    if (wizardData.contractType) {
      onComplete(wizardData.contractType);
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleFeatures = (contractId: string) => {
    setExpandedFeatures(expandedFeatures === contractId ? null : contractId);
  };

  const togglePricing = (contractId: string) => {
    setExpandedPricing(expandedPricing === contractId ? null : contractId);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Choose Contract Type';
      case 2: return 'Review Contract Details';
      case 3: return 'Contract Preview';
      case 4: return 'Final Review';
      default: return 'Generate Contract';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-1 h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {getStepTitle()} - {worker?.full_name}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded-full ${
                  step <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Choose Contract Type</h3>
                <p className="text-muted-foreground">
                  Select the type of contract you want to generate for {worker?.full_name}. 
                  Each option provides different levels of service and compliance management.
                </p>
              </div>

              <div className="grid gap-4">
                {contractOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = wizardData.contractType === option.id;
                  const isFeaturesExpanded = expandedFeatures === option.id;
                  const isPricingExpanded = expandedPricing === option.id;
                  
                  return (
                    <Card 
                      key={option.id}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        isSelected ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleContractTypeSelect(option.id)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <span>{option.title}</span>
                                <div className="text-sm text-muted-foreground font-normal mt-1">
                                  {option.pricing.description}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {option.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFeatures(option.id);
                            }}
                            className="h-auto p-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <span className="flex items-center gap-2">
                              {isFeaturesExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  Hide features
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  Show features
                                </>
                              )}
                            </span>
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePricing(option.id);
                            }}
                            className="h-auto p-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <span className="flex items-center gap-2">
                              {isPricingExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  Hide pricing
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  Show pricing details
                                </>
                              )}
                            </span>
                          </Button>
                        </div>
                        
                        {isFeaturesExpanded && (
                          <div className="mt-3 space-y-2">
                            <span className="text-sm font-medium text-muted-foreground">Key Features:</span>
                            <ul className="text-sm space-y-1">
                              {option.features.map((feature, index) => (
                                <li key={index} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {isPricingExpanded && (
                          <div className="mt-3 space-y-2">
                            <span className="text-sm font-medium text-muted-foreground">Pricing Details:</span>
                            <div className="text-sm space-y-1 bg-muted/50 p-3 rounded-md">
                              <div className="flex justify-between">
                                <span>Monthly Fee:</span>
                                <span className="font-medium">
                                  {option.pricing.monthlyFee ? `$${option.pricing.monthlyFee}` : 'Variable'}
                                  {option.pricing.percentageFee && ` or ${option.pricing.percentageFee}%`}
                                </span>
                              </div>
                              {option.pricing.thresholdAmount && (
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Threshold:</span>
                                  <span>Above ${option.pricing.thresholdAmount} USD/month</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>Setup Fee:</span>
                                <span className="font-medium">{option.pricing.setupFee}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 2 && wizardData.contractType && (
            <ContractDetailsReview 
              worker={worker}
              contract={contract}
              contractType={wizardData.contractType}
              onComplete={handleContractDetailsComplete}
              onCancel={() => onOpenChange(false)}
            />
          )}

          {currentStep === 3 && wizardData.contractDetails && (
            <ContractPreview 
              worker={worker}
              contractType={wizardData.contractType!}
              contractDetails={wizardData.contractDetails}
              onComplete={handlePreviewComplete}
              onCancel={() => onOpenChange(false)}
            />
          )}

          {currentStep === 4 && wizardData.previewData && (
            <ContractFinalReview 
              worker={worker}
              contractType={wizardData.contractType!}
              contractDetails={wizardData.contractDetails}
              previewData={wizardData.previewData}
              contractOptions={contractOptions}
              onComplete={handleFinalComplete}
              onCancel={() => onOpenChange(false)}
            />
          )}

          {/* Cancel button for step 1 */}
          {currentStep === 1 && (
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}