import React from 'react';
import { Badge } from '@/components/ui/badge';
import { EnhancedSkillBadge } from '@/components/ui/enhanced-skill-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Plus, Check, X, Loader2 } from 'lucide-react';
import { CategorizedSkill, SkillsByCategory, useSkillsGeneration } from '@/hooks/useSkillsGeneration';
import { getSkillColor } from '@/utils/skillColors';

interface SkillsGenerationPanelProps {
  profileSummary: string;
  candidateName?: string;
  onSkillsAccepted: (skills: string[]) => void;
  existingSkills: string[];
}

export const SkillsGenerationPanel: React.FC<SkillsGenerationPanelProps> = ({
  profileSummary,
  candidateName,
  onSkillsAccepted,
  existingSkills
}) => {
  const {
    generateSkills,
    clearGeneratedSkills,
    acceptSkill,
    acceptAllSkills,
    getCategoryLabel,
    getCategoryColor,
    isGenerating,
    generatedSkills,
    skillsByCategory
  } = useSkillsGeneration();

  const [selectedSkills, setSelectedSkills] = React.useState<Set<string>>(new Set());

  const handleGenerateSkills = async () => {
    try {
      await generateSkills(profileSummary, candidateName);
      setSelectedSkills(new Set());
    } catch (error) {
      // Error handled in hook
    }
  };

  const toggleSkillSelection = (skillName: string) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(skillName)) {
      newSelected.delete(skillName);
    } else {
      newSelected.add(skillName);
    }
    setSelectedSkills(newSelected);
  };

  const selectAllInCategory = (category: keyof SkillsByCategory) => {
    const newSelected = new Set(selectedSkills);
    skillsByCategory[category].forEach(skill => {
      if (!existingSkills.includes(skill.name)) {
        newSelected.add(skill.name);
      }
    });
    setSelectedSkills(newSelected);
  };

  const deselectAllInCategory = (category: keyof SkillsByCategory) => {
    const newSelected = new Set(selectedSkills);
    skillsByCategory[category].forEach(skill => {
      newSelected.delete(skill.name);
    });
    setSelectedSkills(newSelected);
  };

  const selectAllSkills = () => {
    const newSelected = new Set(selectedSkills);
    generatedSkills.forEach(skill => {
      if (!existingSkills.includes(skill.name)) {
        newSelected.add(skill.name);
      }
    });
    setSelectedSkills(newSelected);
  };

  const deselectAllSkills = () => {
    setSelectedSkills(new Set());
  };

  const handleAcceptSelected = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const skillsToAdd = Array.from(selectedSkills).filter(
      skill => !existingSkills.includes(skill)
    );
    if (skillsToAdd.length > 0) {
      onSkillsAccepted(skillsToAdd);
      setSelectedSkills(new Set());
      clearGeneratedSkills();
    }
  };

  const hasGeneratedSkills = generatedSkills.length > 0;
  const hasSelectedSkills = selectedSkills.size > 0;

  const activeCategoriesCount = Object.keys(skillsByCategory).filter(
    cat => skillsByCategory[cat as keyof SkillsByCategory].length > 0
  ).length;

  if (!profileSummary || profileSummary.trim().length < 10) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Add a profile summary to generate AI-powered skills suggestions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Skills Generation
          </CardTitle>
          <div className="flex gap-2">
            {!hasGeneratedSkills && (
              <Button
                type="button"
                onClick={handleGenerateSkills}
                disabled={isGenerating}
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Skills
                  </>
                )}
              </Button>
            )}
            {hasGeneratedSkills && (
              <>
                <Button
                  type="button"
                  onClick={clearGeneratedSkills}
                  variant="outline"
                  size="sm"
                >
                  Clear All
                </Button>
                <Button
                  type="button"
                  onClick={handleAcceptSelected}
                  disabled={!hasSelectedSkills}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Selected ({selectedSkills.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {hasGeneratedSkills && (
        <CardContent>
          <div className="mb-4 text-sm text-muted-foreground">
            Generated {generatedSkills.length} skills across {activeCategoriesCount} categories. 
            Select skills to add to the candidate profile.
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="all">All ({generatedSkills.length})</TabsTrigger>
              {Object.entries(skillsByCategory).map(([category, skills]) => (
                skills.length > 0 && (
                  <TabsTrigger key={category} value={category}>
                    {getCategoryLabel(category as keyof SkillsByCategory).split(' ')[0]} ({skills.length})
                  </TabsTrigger>
                )
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">All Skills</h4>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllSkills}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={deselectAllSkills}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {generatedSkills.map((skill) => {
                  const isExisting = existingSkills.includes(skill.name);
                  const isSelected = selectedSkills.has(skill.name);
                  
                  return (
                    <div key={skill.name} className="relative">
                      <div 
                        className={`cursor-pointer transition-all ${
                          isExisting 
                            ? "opacity-50 cursor-not-allowed" 
                            : "hover:scale-105"
                        } ${isSelected ? "ring-2 ring-primary" : ""}`}
                        onClick={() => !isExisting && toggleSkillSelection(skill.name)}
                      >
                        <EnhancedSkillBadge
                          skill={skill.name}
                          analysis={{
                            matchRelevance: Math.round(skill.confidence * 100)
                          }}
                          variant="compact"
                          showTooltip={true}
                          interactive={false}
                        />
                        {isSelected && <Check className="h-3 w-3 ml-1 absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5" />}
                        {isExisting && <span className="ml-1 text-xs opacity-75">(exists)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {Object.entries(skillsByCategory).map(([category, skills]) => (
              skills.length > 0 && (
                <TabsContent key={category} value={category} className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{getCategoryLabel(category as keyof SkillsByCategory)}</h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllInCategory(category as keyof SkillsByCategory)}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deselectAllInCategory(category as keyof SkillsByCategory)}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => {
                      const isExisting = existingSkills.includes(skill.name);
                      const isSelected = selectedSkills.has(skill.name);
                      
                        return (
                          <div key={skill.name} className="relative">
                            <div 
                              className={`cursor-pointer transition-all ${
                                isExisting 
                                  ? "opacity-50 cursor-not-allowed" 
                                  : "hover:scale-105"
                              } ${isSelected ? "ring-2 ring-primary" : ""}`}
                              onClick={() => !isExisting && toggleSkillSelection(skill.name)}
                            >
                              <EnhancedSkillBadge
                                skill={skill.name}
                                analysis={{
                                  matchRelevance: Math.round(skill.confidence * 100)
                                }}
                                variant="compact"
                                showTooltip={true}
                                interactive={false}
                              />
                              {isSelected && <Check className="h-3 w-3 ml-1 absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5" />}
                              {isExisting && <span className="ml-1 text-xs opacity-75">(exists)</span>}
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </TabsContent>
              )
            ))}
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
};