import { supabase } from './supabaseClient'

/**
 * Get all organization IDs in the tree for a given org
 * Includes the org itself, its parent (if any), and all children
 */
export async function getOrganizationTree(organizationId: string): Promise<string[]> {
  const orgIds = new Set<string>([organizationId])
  
  try {
    // Get the current org details
    const { data: currentOrg, error: orgError } = await supabase
      .from('organizations')
      .select('id, parent_organization_id')
      .eq('id', organizationId)
      .single()
    
    if (orgError) throw orgError
    
    // If has parent, add parent and its children
    if (currentOrg.parent_organization_id) {
      orgIds.add(currentOrg.parent_organization_id)
      
      // Get all siblings (children of parent)
      const { data: siblings, error: siblingsError } = await supabase
        .from('organizations')
        .select('id')
        .eq('parent_organization_id', currentOrg.parent_organization_id)
      
      if (!siblingsError && siblings) {
        siblings.forEach(s => orgIds.add(s.id))
      }
    }
    
    // Get all children of current org
    const { data: children, error: childrenError } = await supabase
      .from('organizations')
      .select('id')
      .eq('parent_organization_id', organizationId)
    
    if (!childrenError && children) {
      children.forEach(c => orgIds.add(c.id))
    }
    
    return Array.from(orgIds)
  } catch (error) {
    console.error('Error fetching organization tree:', error)
    // Fallback to just the current org
    return [organizationId]
  }
}
