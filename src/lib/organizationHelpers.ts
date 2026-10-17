import { supabase } from './supabaseClient'

/**
 * Get all organization IDs in the tree for a given org
 * Includes the org itself, its parent (if any), and all children
 */
// One lookup per organization every 5 minutes, shared by every caller; several
// screens asked for the same tree on each page load (2026-10-17).
const TREE_TTL_MS = 5 * 60 * 1000
const treeCache = new Map<string, { at: number; tree: Promise<string[]> }>()

export function getOrganizationTree(organizationId: string): Promise<string[]> {
  const hit = treeCache.get(organizationId)
  if (hit && Date.now() - hit.at < TREE_TTL_MS) return hit.tree
  // A failed lookup falls back to just the current org and isn't kept, so the
  // next caller tries again.
  const tree = loadOrganizationTree(organizationId).catch((error) => {
    console.error('Error fetching organization tree:', error)
    treeCache.delete(organizationId)
    return [organizationId]
  })
  treeCache.set(organizationId, { at: Date.now(), tree })
  return tree
}

async function loadOrganizationTree(organizationId: string): Promise<string[]> {
  const orgIds = new Set<string>([organizationId])
  
  // The current org and its children load side by side (2026-10-17).
  const [{ data: currentOrg, error: orgError }, { data: children, error: childrenError }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, parent_organization_id')
      .eq('id', organizationId)
      .single(),
    supabase
      .from('organizations')
      .select('id')
      .eq('parent_organization_id', organizationId),
  ])

  if (orgError) throw orgError

  if (!childrenError && children) {
    children.forEach(c => orgIds.add(c.id))
  }

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

  return Array.from(orgIds)
}
