import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Users, Sparkles, CreditCard } from 'lucide-react';
import { useCreateCheckout } from '@/hooks/useBillingPortal';
import { useStripePricing } from '@/hooks/useStripePricing';
import { formatPrice } from '@/utils/pricing';

interface PerSeatPricingCardProps {
  showTrialCTA?: boolean;
  currentSeats?: number;
  billingInterval?: 'month' | 'year';
}

export function PerSeatPricingCard({ 
  showTrialCTA = false, 
  currentSeats = 1,
  billingInterval = 'month'
}: PerSeatPricingCardProps) {
  const [isAnnual, setIsAnnual] = useState(billingInterval === 'year');
  const { data: pricing, isLoading: pricingLoading } = useStripePricing();
  const { mutate: createCheckout, isPending } = useCreateCheckout();

  const handleSubscribe = () => {
    createCheckout({ interval: isAnnual ? 'year' : 'month' });
  };

  if (pricingLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const monthlyPrice = pricing?.seatMonthly?.amount || 9900;
  const annualPrice = pricing?.seatAnnual?.amount || 99900;
  const monthlyEquivalent = Math.round(annualPrice / 12);
  const savings = Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100);
  
  const creditsPerSeat = isAnnual ? 120 : 100;
  const totalCredits = currentSeats * creditsPerSeat;

  const features = [
    'Unlimited jobs & candidates',
    'Email integration (Gmail, Outlook)',
    'Calendar sync & scheduling',
    'Automated workflows',
    'AI-powered screening',
    'Custom hiring pipelines',
    `${creditsPerSeat} enrichment credits/seat/month`,
    'Free hiring managers & interviewers',
  ];

  return (
    <Card className="relative overflow-hidden">
      {isAnnual && (
        <div className="absolute top-0 right-0">
          <Badge className="rounded-none rounded-bl-lg bg-emerald-500 hover:bg-emerald-600">
            Save {savings}%
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">GoGio ATS</CardTitle>
        <CardDescription>
          Per-seat pricing for your recruiting team
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3">
          <Label htmlFor="billing-toggle" className={!isAnnual ? 'font-semibold' : 'text-muted-foreground'}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <Label htmlFor="billing-toggle" className={isAnnual ? 'font-semibold' : 'text-muted-foreground'}>
            Annual
          </Label>
        </div>

        {/* Pricing Display */}
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold">
              {formatPrice(isAnnual ? monthlyEquivalent : monthlyPrice, 'usd')}
            </span>
            <span className="text-muted-foreground">/seat/month</span>
          </div>
          {isAnnual && (
            <p className="text-sm text-muted-foreground mt-1">
              Billed annually ({formatPrice(annualPrice, 'usd')}/seat/year)
            </p>
          )}
        </div>

        {/* Credit Info */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">Pooled Enrichment Credits</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {creditsPerSeat} credits per seat per month ({isAnnual ? '20% more than monthly!' : 'Annual gets 20% more'})
          </p>
          {currentSeats > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              Your team: {currentSeats} seats × {creditsPerSeat} = {totalCredits} credits/month
            </p>
          )}
        </div>

        {/* Features */}
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {showTrialCTA && (
          <div className="space-y-3">
            <Button 
              onClick={handleSubscribe} 
              disabled={isPending}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Start 14-Day Free Trial
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Card required. Cancel anytime during trial. Get {pricing?.trialCredits || 20} enrichment credits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
