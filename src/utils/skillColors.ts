// Utility function to assign pastel colors to skills
export const pastelColors = [
  'pastel-blue',
  'pastel-purple', 
  'pastel-green',
  'pastel-pink',
  'pastel-yellow',
  'pastel-orange'
] as const;

export type PastelColor = typeof pastelColors[number];

export function getSkillColor(skill: string): PastelColor {
  // Simple hash function to get consistent colors for the same skill
  let hash = 0;
  for (let i = 0; i < skill.length; i++) {
    const char = skill.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Get a color based on the hash
  const colorIndex = Math.abs(hash) % pastelColors.length;
  return pastelColors[colorIndex];
}