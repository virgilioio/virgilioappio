import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Loader2, Sparkles, Zap } from 'lucide-react';
import { useCreateCreditPurchase } from '@/hooks/useCreateCreditPurchase';
import { useStripePricing } from '@/hooks/useStripePricing';
import { formatPrice } from '@/utils/pricing';

interface CreditBundleCardProps {
  bonusCreditsAvailable?: number;
}

export function CreditBundleCard({ bonusCreditsAvailable = 0 }: CreditBundleCardProps) {
  const { data: pricing, isLoading: pricingLoading } = useStripePricing();
  const { mutate: purchaseCredits, isPending } = useCreateCreditPurchase();

  const handlePurchase = (bundleSize: '500' | '1500' | '5000') => {
    purchaseCredits({ bundleSize });
  };

  if (pricingLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Credit Bundles
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const bundles = pricing?.creditBundles || [
    { id: 'bundle_500', credits: 500, amount: 4900, currency: 'usd' },
    { id: 'bundle_1500', credits: 1500, amount: 12900, currency: 'usd', savings: 'Save 12%' },
    { id: 'bundle_5000', credits: 5000, amount: 34900, currency: 'usd', savings: 'Save 29%' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Credit Bundles
            </CardTitle>
            <CardDescription className="mt-1">
              Add-on credits for enrichment. Never expire while subscription is active.
            </CardDescription>
          </div>
          {bonusCreditsAvailable > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {bonusCreditsAvailable.toLocaleString()} bonus credits available
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {bundles.map((bundle) => {
            const bundleSize = bundle.credits.toString() as '500' | '1500' | '5000';
            const pricePerCredit = (bundle.amount / bundle.credits).toFixed(2);
            const isPopular = bundle.credits === 1500;
            const isBestValue = bundle.credits === 5000;

            return (
              <div
                key={bundle.id}
                className={`relative rounded-lg border p-4 ${
                  isPopular ? 'border-primary ring-1 ring-primary' : ''
                } ${isBestValue ? 'border-emerald-500 ring-1 ring-emerald-500' : ''}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                {isBestValue && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500">
                    Best Value
                  </Badge>
                )}

                <div className="text-center pt-2">
                  <div className="text-3xl font-bold">
                    {bundle.credits.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    credits
                  </div>

                  <div className="text-2xl font-semibold">
                    {formatPrice(bundle.amount, bundle.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    ${pricePerCredit} per credit
                  </div>

                  {bundle.savings && (
                    <Badge variant="outline" className="mb-3 text-emerald-600 border-emerald-300">
                      {bundle.savings}
                    </Badge>
                  )}

                  <Button
                    onClick={() => handlePurchase(bundleSize)}
                    disabled={isPending}
                    className="w-full mt-2"
                    variant={isPopular || isBestValue ? 'default' : 'outline'}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-1" />
                        Buy Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Credit bundles are one-time purchases. Credits never expire while your subscription is active.
        </p>
      </CardContent>
    </Card>
  );
}
