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

export interface RoleLevel {
  level: string; // e.g., intern, ic, senior ic, lead, manager, director, vp, cxo, volunteer
  confidence: number;
  rationale?: string;
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
  const [roleLevel, setRoleLevel] = useState<RoleLevel | null>(null);


  const generateSkills = async (
    text: string,
    nameOrTitle?: string,
    options?: { context?: 'candidate' | 'job'; desiredCount?: number; minCount?: number }
  ) => {
    if (!text || text.trim().length < 10) {
      toast.error('Text is too short to generate skills');
      return;
    }

    setIsGenerating(true);
    try {
      const context = options?.context ?? 'candidate';
      const desiredCount = options?.desiredCount ?? 20;
      const minCount = options?.minCount ?? 15;

      console.log('Generating skills...', { context, desiredCount, minCount });

      const body: any = {
        profileSummary: text.trim(),
        context,
        desiredCount,
        minCount,
      };

      if (context === 'job') {
        body.jobTitle = nameOrTitle || 'Unknown';
      } else {
        body.candidateName = nameOrTitle || 'Unknown';
      }

      const { data, error } = await supabase.functions.invoke('generate-comprehensive-skills', {
        body
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
      const role = (data.roleLevel || data.role_level) as RoleLevel | undefined;

      setGeneratedSkills(skills);
      setSkillsByCategory(categories);
      setRoleLevel(role ?? null);

      toast.success(`Generated ${skills.length} skills${role?.level ? ` · detected level: ${role.level}` : ''}`);

      return { skills, skillsByCategory: categories, roleLevel: role ?? null };

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
    setRoleLevel(null);
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
    skillsByCategory,
    roleLevel,
  };
};