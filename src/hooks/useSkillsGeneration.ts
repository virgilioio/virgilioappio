import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CategorizedSkill {
  name: string;
  category: 'technical' | 'tools' | 'industries' | 'titles' | 'soft' | 'certifications';
  confidence: number;
  source: 'manual' | 'ai_generated';
}

export interface SkillsByCategory {
  technical: CategorizedSkill[];
  tools: CategorizedSkill[];
  industries: CategorizedSkill[];
  titles: CategorizedSkill[];
  soft: CategorizedSkill[];
  certifications: CategorizedSkill[];
}

export const useSkillsGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSkills, setGeneratedSkills] = useState<CategorizedSkill[]>([]);
  const [skillsByCategory, setSkillsByCategory] = useState<SkillsByCategory>({
    technical: [],
    tools: [],
    industries: [],
    titles: [],
    soft: [],
    certifications: []
  });

  const generateSkills = async (profileSummary: string, candidateName?: string) => {
    if (!profileSummary || profileSummary.trim().length < 10) {
      toast.error('Profile summary is too short to generate skills');
      return;
    }

    setIsGenerating(true);
    try {
      console.log('Generating skills from profile summary...');
      
      const { data, error } = await supabase.functions.invoke('generate-comprehensive-skills', {
        body: {
          profileSummary: profileSummary.trim(),
          candidateName: candidateName || 'Unknown'
        }
      });

      if (error) {
        console.error('Error generating skills:', error);
        throw new Error(error.message || 'Failed to generate skills');
      }

      if (!data || !data.skills) {
        throw new Error('No skills were generated');
      }

      const skills = data.skills as CategorizedSkill[];
      const categories = data.skillsByCategory as SkillsByCategory;

      setGeneratedSkills(skills);
      setSkillsByCategory(categories);

      toast.success(`Generated ${skills.length} skills across ${Object.keys(categories).filter(cat => categories[cat as keyof SkillsByCategory].length > 0).length} categories`);

      return { skills, skillsByCategory: categories };

    } catch (error) {
      console.error('Skills generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate skills');
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearGeneratedSkills = () => {
    setGeneratedSkills([]);
    setSkillsByCategory({
      technical: [],
      tools: [],
      industries: [],
      titles: [],
      soft: [],
      certifications: []
    });
  };

  const acceptSkill = (skill: CategorizedSkill) => {
    return {
      ...skill,
      source: 'manual' as const // Convert to manual when accepted
    };
  };

  const acceptAllSkills = (category?: keyof SkillsByCategory) => {
    if (category) {
      return skillsByCategory[category].map(acceptSkill);
    } else {
      return generatedSkills.map(acceptSkill);
    }
  };

  const getCategoryLabel = (category: keyof SkillsByCategory): string => {
    const labels = {
      technical: 'Technical Skills',
      tools: 'Tools & Platforms',
      industries: 'Industry Experience',
      titles: 'Job Titles & Roles',
      soft: 'Soft Skills',
      certifications: 'Certifications'
    };
    return labels[category];
  };

  const getCategoryColor = (category: keyof SkillsByCategory): string => {
    const colors = {
      technical: 'bg-blue-100 text-blue-800 border-blue-200',
      tools: 'bg-purple-100 text-purple-800 border-purple-200',
      industries: 'bg-green-100 text-green-800 border-green-200',
      titles: 'bg-orange-100 text-orange-800 border-orange-200',
      soft: 'bg-pink-100 text-pink-800 border-pink-200',
      certifications: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[category];
  };

  return {
    generateSkills,
    clearGeneratedSkills,
    acceptSkill,
    acceptAllSkills,
    getCategoryLabel,
    getCategoryColor,
    isGenerating,
    generatedSkills,
    skillsByCategory
  };
};