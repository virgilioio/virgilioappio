import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Info, CheckCircle, AlertCircle, Brain, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MatchEnrichmentInsightsProps {
  enrichmentData?: {
    termsAdded: number;
    synonymsAdded: number;
    newVariationsUsed: string[];
    libraryEnriched: boolean;
  };
  normalizationMetadata?: any;
  className?: string;
}

export function MatchEnrichmentInsights({ 
  enrichmentData, 
  normalizationMetadata, 
  className 
}: MatchEnrichmentInsightsProps) {
  const hasEnrichmentData = enrichmentData && (enrichmentData.termsAdded > 0 || enrichmentData.synonymsAdded > 0);
  const hasNormalizationData = normalizationMetadata && Object.keys(normalizationMetadata).length > 0;

  if (!hasEnrichmentData && !hasNormalizationData) {
    return null;
  }

  return (
    <TooltipProvider>
      <Card className={`p-4 space-y-3 border-blue-200 bg-blue-50/50 ${className}`}>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Smart Matching Insights</span>
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
            AI Enhanced
          </Badge>
        </div>
        
        <div className="space-y-3">
          {/* Normalization insights */}
          {hasNormalizationData && (
            <div className="p-3 bg-white rounded-md border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span className="text-xs font-medium text-gray-700">Standardization Applied</span>
              </div>
              
              <div className="space-y-2">
                {normalizationMetadata.skills_mapping && normalizationMetadata.skills_mapping.length > 0 && (
                  <div className="text-xs">
                    <span className="text-gray-600">Skills standardized:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {normalizationMetadata.skills_mapping.slice(0, 3).map((skill: any, index: number) => (
                        <Tooltip key={index}>
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
                      ))}
                      {normalizationMetadata.skills_mapping.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{normalizationMetadata.skills_mapping.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Library enrichment insights */}
          {hasEnrichmentData && (
            <div className="p-3 bg-white rounded-md border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium text-gray-700">Library Learning</span>
                <Badge variant="outline" className="text-xs border-green-200 text-green-700">
                  Live Data
                </Badge>
              </div>
              
              <div className="space-y-2">
                {enrichmentData.termsAdded > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-gray-600">
                      Added <strong>{enrichmentData.termsAdded}</strong> new terms to library
                    </span>
                  </div>
                )}
                
                {enrichmentData.synonymsAdded > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-gray-600">
                      Discovered <strong>{enrichmentData.synonymsAdded}</strong> new synonyms
                    </span>
                  </div>
                )}
                
                {enrichmentData.newVariationsUsed && enrichmentData.newVariationsUsed.length > 0 && (
                  <div className="text-xs">
                    <span className="text-gray-600">New variations used:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {enrichmentData.newVariationsUsed.slice(0, 3).map((variation, index) => (
                        <Badge key={index} variant="outline" className="text-xs border-green-200 text-green-700">
                          {variation}
                        </Badge>
                      ))}
                      {enrichmentData.newVariationsUsed.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{enrichmentData.newVariationsUsed.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-blue-700 pt-2 border-t border-blue-100">
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            <span>
              This search improved our matching accuracy by learning from real candidate data.
            </span>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}