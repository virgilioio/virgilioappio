export interface JobForBoolean {
  title?: string;
  skills?: string[];
  location?: string;
}

/**
 * Generates a default boolean search query from job specifications.
 * 
 * @param job - Job object with title, skills, and location
 * @returns Boolean query string (e.g., "software engineer" AND ("React" OR "Node.js") AND ("San Francisco" OR "Remote"))
 */
export function buildDefaultBoolean(job: JobForBoolean): string {
  const parts: string[] = [];

  // Title: if present → wrap in quotes
  if (job.title?.trim()) {
    parts.push(`"${job.title.trim()}"`);
  }

  // Skills: take top 6 → quote each → OR together
  if (job.skills && job.skills.length > 0) {
    const topSkills = job.skills
      .slice(0, 6)
      .map(skill => `"${skill.trim()}"`)
      .filter(Boolean);
    
    if (topSkills.length > 0) {
      parts.push(`(${topSkills.join(' OR ')})`);
    }
  }

  // Location: parse and handle (could be comma-separated or single)
  if (job.location?.trim()) {
    const locationParts = job.location
      .split(',')
      .map(loc => loc.trim())
      .filter(Boolean)
      .slice(0, 3) // Max 3 locations
      .map(loc => `"${loc}"`);
    
    if (locationParts.length > 0) {
      parts.push(`(${locationParts.join(' OR ')})`);
    }
  }

  // Join with AND, omit empty parts
  return parts.filter(Boolean).join(' AND ');
}
