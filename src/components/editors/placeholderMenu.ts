import { createContext } from 'react';
import { AVAILABLE_PLACEHOLDERS } from '@/utils/placeholderUtils';

/**
 * The variables a pill can be swapped for (2026-11-06): clicking a pill in a
 * template editor opens a menu with these and Remove. Each editor passes its own
 * list (`variables`); without one, the general email list.
 */
export interface PillVariable {
  key: string;
  label: string;
  group?: string;
  /** Still filled in older emails, so a pill using it isn't flagged; only listed when it's the pill's own key. */
  legacy?: boolean;
}

export const DEFAULT_PILL_VARIABLES: PillVariable[] = AVAILABLE_PLACEHOLDERS.map((p) => ({
  key: p.value,
  label: p.label,
  group: p.category,
}));

export const PillVariablesContext = createContext<PillVariable[]>(DEFAULT_PILL_VARIABLES);
