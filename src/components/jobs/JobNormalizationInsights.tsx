import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface JobNormalizationInsightsProps {
  normalizationMetadata?: any;
  className?: string;
}

export function JobNormalizationInsights({ normalizationMetadata, className }: JobNormalizationInsightsProps) {
  if (!normalizationMetadata || Object.keys(normalizationMetadata).length === 0) {
    return null;
  }

  const { title_mapping, skills_mapping, location_mapping, ai_variations_used } = normalizationMetadata;

  const hasNormalizations = title_mapping || (skills_mapping && skills_mapping.length > 0) || location_mapping;

  if (!hasNormalizations) {
    return null;
  }

  return (
    <TooltipProvider>
      <Card className={`p-3 space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Standardization Applied</span>
          {ai_variations_used && (
            <Badge variant="secondary" className="text-xs">
              AI Enhanced
            </Badge>
          )}
        </div>
        
        <div className="space-y-2">
          {title_mapping && (
            <div className="flex items-start gap-2">
              <CheckCircle className="h-3 w-3 text-green-500 mt-0.5" />
              <div className="text-xs">
                <span className="text-muted-foreground">Title:</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 font-medium cursor-help">
                      "{title_mapping.original}" → "{title_mapping.canonical}"
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {title_mapping.synonyms_used && title_mapping.synonyms_used.length > 0 && (
                      <div>
                        <div className="font-medium">Synonyms used:</div>
                        <div>{title_mapping.synonyms_used.join(', ')}</div>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
          
          {skills_mapping && skills_mapping.length > 0 && (
            <div className="flex items-start gap-2">
              <CheckCircle className="h-3 w-3 text-green-500 mt-0.5" />
              <div className="text-xs">
                <span className="text-muted-foreground">Skills standardized:</span>
                <div className="mt-1 space-y-1">
                  {skills_mapping.slice(0, 3).map((skill: any, index: number) => (
                    <div key={index} className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs cursor-help">
                            {skill.canonical}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div>
                            <div className="font-medium">Original: {skill.original}</div>
                            {skill.synonyms_used && skill.synonyms_used.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Via: {skill.synonyms_used.join(', ')}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                  {skills_mapping.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{skills_mapping.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {location_mapping && (
            <div className="flex items-start gap-2">
              <CheckCircle className="h-3 w-3 text-green-500 mt-0.5" />
              <div className="text-xs">
                <span className="text-muted-foreground">Location:</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 font-medium cursor-help">
                      "{location_mapping.original}" → "{location_mapping.canonical}"
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {location_mapping.synonyms_used && location_mapping.synonyms_used.length > 0 && (
                      <div>
                        <div className="font-medium">Synonyms used:</div>
                        <div>{location_mapping.synonyms_used.join(', ')}</div>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground pt-1 border-t">
          This improves candidate matching accuracy by using standardized terms and synonyms.
        </div>
      </Card>
    </TooltipProvider>
  );
}