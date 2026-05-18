import { differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';

/**
 * Concise "moved here" format aligned with the project's Xd standard.
 * Returns "just now", "12m", "3h", or "12d".
 */
export function formatMovedHere(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = differenceInHours(now, date);
  if (hrs < 24) return `${hrs}h`;
  const days = differenceInDays(now, date);
  return `${days}d`;
}
