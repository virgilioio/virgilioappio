import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Building, UserCheck, ChevronDown, ChevronUp } from "lucide-react";

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
    ]
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
    ]
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
    ]
  }
];

export function ContractCreationWizard({ 
  open, 
  onOpenChange, 
  worker, 
  contract, 
  onComplete 
}: ContractCreationWizardProps) {
  const [selectedContractType, setSelectedContractType] = useState<ContractType | null>(null);
  const [expandedFeatures, setExpandedFeatures] = useState<string | null>(null);

  const handleContractTypeSelect = (contractType: ContractType) => {
    setSelectedContractType(contractType);
  };

  const handleContinue = () => {
    if (selectedContractType) {
      onComplete(selectedContractType);
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    setSelectedContractType(null);
  };

  const toggleFeatures = (contractId: string) => {
    setExpandedFeatures(expandedFeatures === contractId ? null : contractId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Contract - {worker?.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
            <span>Select Contract Type</span>
          </div>

          {/* Contract Type Selection */}
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
                const isSelected = selectedContractType === option.id;
                const isExpanded = expandedFeatures === option.id;
                
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
                            <span>{option.title}</span>
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
                    <CardContent className="pt-0">
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
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Hide features
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Show key features
                            </>
                          )}
                        </span>
                      </Button>
                      
                      {isExpanded && (
                        <div className="mt-3 space-y-2">
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleContinue}
              disabled={!selectedContractType}
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}