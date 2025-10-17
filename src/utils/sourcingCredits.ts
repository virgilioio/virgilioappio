/**
 * Sourcing credits utility functions
 * Used to check if sourcing operations are allowed based on credit balance
 */

export interface CreditCheck {
  canProceed: boolean;
  reason?: string;
}

/**
 * Check if external search can be performed
 */
export function canRunExternalSearch(params: { searchRemaining: number }): CreditCheck {
  const { searchRemaining } = params;

  if (searchRemaining <= 0) {
    return {
      canProceed: false,
      reason: 'No search credits remaining. Contact your administrator to refill credits.'
    };
  }

  return { canProceed: true };
}

/**
 * Check if candidate profile collection can be performed
 */
export function canCollect(params: { collectRemaining: number }): CreditCheck {
  const { collectRemaining } = params;

  if (collectRemaining <= 0) {
    return {
      canProceed: false,
      reason: 'No collect credits remaining. Contact your administrator to refill credits.'
    };
  }

  return { canProceed: true };
}

/**
 * Get warning level based on percentage remaining
 */
export function getCreditWarningLevel(remaining: number, limit: number): 'none' | 'warning' | 'critical' {
  if (limit === 0) return 'none';
  
  const percentage = (remaining / limit) * 100;
  
  if (percentage === 0) return 'critical';
  if (percentage < 20) return 'warning';
  return 'none';
}

/**
 * Format refill date for display
 */
export function formatRefillDate(dateString: string | null): string {
  if (!dateString) return 'Not scheduled';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}
