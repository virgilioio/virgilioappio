import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useOnboardingTasks } from '@/hooks/useOnboardingTasks';
import { cn } from '@/lib/utils';

interface OnboardingTabProps {
  applicationId: string | null;
  startDate?: string | null;
  firstName?: string;
}

export function OnboardingTab({ applicationId, startDate }: OnboardingTabProps) {
  const { tasks, isLoading, doneCount, totalCount, toggle, add } = useOnboardingTasks(applicationId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const dueBeforeStart = (() => {
    if (!startDate) return 0;
    try {
      const start = parseISO(startDate);
      return tasks.filter(
        (t) => !t.done && t.due_date && differenceInCalendarDays(start, parseISO(t.due_date)) >= 0,
      ).length;
    } catch {
      return 0;
    }
  })();

  if (!applicationId) return null;

  return (
    <section
      className="bg-white rounded-[14px] border"
      style={{ borderColor: '#E7E8EE' }}
    >
      <header
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: '#F1F0EC' }}
      >
        <div>
          <h3
            className="font-poppins font-semibold text-[#0d0d09]"
            style={{ fontSize: 15, letterSpacing: '-0.02em' }}
          >
            Onboarding checklist
          </h3>
          <p
            className="font-inter mt-0.5"
            style={{ fontSize: 12, color: '#5A6072' }}
          >
            {doneCount} of {totalCount} complete
            {startDate && dueBeforeStart > 0 && ` · ${dueBeforeStart} due before start date`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          onClick={() => setAdding(true)}
        >
          Add task
        </Button>
      </header>

      <div className="px-2">
        {isLoading ? (
          <div className="p-6 text-[12.5px]" style={{ color: '#8B8F9E' }}>Loading…</div>
        ) : (
          <ul>
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0"
                style={{ borderColor: '#F1F0EC' }}
              >
                <button
                  type="button"
                  onClick={() => toggle({ id: task.id, done: !task.done })}
                  aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                  className={cn(
                    'shrink-0 flex items-center justify-center transition-colors',
                  )}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: task.done ? '#12B886' : 'transparent',
                    border: task.done ? '1.5px solid #12B886' : '1.5px solid #C2C6D2',
                  }}
                >
                  {task.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </button>
                <span
                  className={cn('flex-1 font-inter')}
                  style={{
                    fontSize: 12.5,
                    color: task.done ? '#8B8F9E' : '#1F2230',
                    textDecoration: task.done ? 'line-through' : 'none',
                  }}
                >
                  {task.label}
                </span>
                {task.owner_label && (
                  <span
                    className="font-inter shrink-0"
                    style={{ fontSize: 11, color: '#5A6072' }}
                  >
                    {task.owner_label}
                  </span>
                )}
                {!task.done && task.due_date && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: '#FEF3C7', color: '#854D0E', fontSize: 10.5 }}
                  >
                    <span className="inline-block rounded-full" style={{ width: 5, height: 5, backgroundColor: '#CA8A04' }} />
                    {format(parseISO(task.due_date), 'MMM d')}
                  </span>
                )}
              </li>
            ))}
            {adding && (
              <li className="flex items-center gap-3 px-3 py-2.5">
                <span className="shrink-0" style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid #C2C6D2' }} />
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draft.trim()) {
                      add(draft.trim());
                      setDraft('');
                      setAdding(false);
                    }
                    if (e.key === 'Escape') {
                      setDraft('');
                      setAdding(false);
                    }
                  }}
                  onBlur={() => {
                    if (draft.trim()) add(draft.trim());
                    setDraft('');
                    setAdding(false);
                  }}
                  placeholder="New task…"
                  className="flex-1 font-inter bg-transparent outline-none"
                  style={{ fontSize: 12.5, color: '#1F2230' }}
                />
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
