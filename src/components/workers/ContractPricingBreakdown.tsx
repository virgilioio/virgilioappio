import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calculator, CreditCard, Calendar } from "lucide-react";

interface ContractPricingBreakdownProps {
  contractType: 'cor' | 'eor' | 'direct';
  workerSalary: number;
  currency: string;
  paymentPeriod: string;
  pricingOptions?: {
    monthlyFee?: number;
    percentageFee?: number;
    thresholdAmount?: number;
    setupFee: string;
    description: string;
  };
}

export function ContractPricingBreakdown({ 
  contractType, 
  workerSalary, 
  currency, 
  paymentPeriod,
  pricingOptions 
}: ContractPricingBreakdownProps) {
  const formatCurrency = (amount: number, currencyCode: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  };

  const calculateMonthlyWorkerSalary = () => {
    const salary = workerSalary || 0;
    switch (paymentPeriod) {
      case 'annual': return salary / 12;
      case 'monthly': return salary;
      case 'biweekly': return (salary * 26) / 12;
      case 'weekly': return (salary * 52) / 12;
      case 'hourly': return salary * 160; // Assuming 160 hours/month
      default: return salary;
    }
  };

  const calculateVirgilioPlatformFee = () => {
    if (!pricingOptions) return 0;
    
    const monthlySalary = calculateMonthlyWorkerSalary();
    
    if (contractType === 'cor') {
      // COR: $189 or 12.5% for salaries above $1,500
      if (monthlySalary > (pricingOptions.thresholdAmount || 1500)) {
        const percentageFee = (monthlySalary * (pricingOptions.percentageFee || 12.5)) / 100;
        return Math.max(percentageFee, pricingOptions.monthlyFee || 189);
      }
      return pricingOptions.monthlyFee || 189;
    }
    
    // EOR and Direct use fixed monthly fees
    return pricingOptions.monthlyFee || 0;
  };

  const calculateSetupFee = () => {
    const monthlySalary = calculateMonthlyWorkerSalary();
    const platformFee = calculateVirgilioPlatformFee();
    
    // Setup fee is one month in advance + current pay cycle amount
    return monthlySalary + platformFee;
  };

  const monthlySalary = calculateMonthlyWorkerSalary();
  const platformFee = calculateVirgilioPlatformFee();
  const setupFee = calculateSetupFee();
  const totalFirstPayment = setupFee;
  const totalMonthlyRecurring = monthlySalary + platformFee;

  const getContractTypeTitle = () => {
    switch (contractType) {
      case 'cor': return 'COR Contract';
      case 'eor': return 'EOR Contract';
      case 'direct': return 'Direct Contract';
      default: return 'Contract';
    }
  };

  const getPlatformFeeBadge = () => {
    if (contractType === 'cor' && pricingOptions?.percentageFee && monthlySalary > (pricingOptions.thresholdAmount || 1500)) {
      return (
        <Badge variant="secondary" className="text-xs">
          {pricingOptions.percentageFee}% of salary
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        Fixed monthly fee
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Virgilio Pricing Breakdown
        </CardTitle>
        <CardDescription>
          Detailed breakdown of Virgilio's service fees for {getContractTypeTitle()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Salary Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Worker Compensation
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base salary ({paymentPeriod}):</span>
              <span>{formatCurrency(workerSalary, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly equivalent:</span>
              <span className="font-medium">{formatCurrency(monthlySalary, currency)}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Virgilio Fees */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Virgilio Platform Fees
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Platform fee:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(platformFee, 'USD')}/month</span>
                {getPlatformFeeBadge()}
              </div>
            </div>
            
            {contractType === 'cor' && pricingOptions?.thresholdAmount && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                COR pricing: ${pricingOptions.monthlyFee} flat fee or {pricingOptions.percentageFee}% of salary 
                (whichever is greater) for salaries above ${pricingOptions.thresholdAmount} USD/month
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Setup fee (one-time):</span>
              <span className="font-medium">{formatCurrency(setupFee, currency)}</span>
            </div>
            
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              Setup fee includes: One month platform fee in advance + one month worker salary
            </div>
          </div>
        </div>

        <Separator />

        {/* Payment Schedule */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Payment Schedule
          </div>
          <div className="space-y-2">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">First Payment (Setup):</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(totalFirstPayment, currency)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Includes worker salary + platform setup fee
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Monthly Recurring:</span>
                <span className="text-lg font-bold">
                  {formatCurrency(totalMonthlyRecurring, currency)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Worker salary + Virgilio platform fee
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="text-sm font-medium">What's Included:</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            {contractType === 'eor' && (
              <>
                <li>• Full employment compliance & legal protection</li>
                <li>• Benefits administration & payroll management</li>
                <li>• Cross-border employment handling</li>
              </>
            )}
            {contractType === 'cor' && (
              <>
                <li>• Independent contractor compliance management</li>
                <li>• Global payment processing & tax handling</li>
                <li>• Multi-currency support & conversion</li>
              </>
            )}
            {contractType === 'direct' && (
              <>
                <li>• Platform management tools & contract templates</li>
                <li>• Direct employment support & guidance</li>
                <li>• Self-service setup & customization</li>
              </>
            )}
            <li>• 24/7 customer support & compliance updates</li>
            <li>• Secure payment infrastructure & reporting</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}