import { lazy, Suspense, useSyncExternalStore } from 'react';
import { clearRestored, getRestored, subscribeRestored } from '@/lib/emailOutbox';

/**
 * Undo Send (2026-11-11): reopens a draft after Undo or "Open draft", wherever you are
 * now, even when the page that wrote it has closed. Mounted once in App.tsx; the
 * composer (and its editor) loads only when a draft comes back.
 */
const MinimizableEmailComposer = lazy(() =>
  import('@/components/candidates/MinimizableEmailComposer').then((m) => ({ default: m.MinimizableEmailComposer })),
);
export function EmailOutboxHost() {
  const restored = useSyncExternalStore(subscribeRestored, getRestored, getRestored);
  if (!restored) return null;
  const d = restored.draft;
  return (
    <Suspense fallback={null}>
    <MinimizableEmailComposer
      key={restored.key}
      isOpen
      onOpenChange={(open) => !open && clearRestored()}
      candidateId={d.candidateId}
      jobId={d.jobId}
      jhsId={d.jhsId}
      associationId={d.associationId}
      inReplyToMessageId={d.inReplyToMessageId}
      candidateName={d.candidateName}
      mode={d.mode}
      bulk={d.bulk}
      bulkJobTitle={d.bulkJobTitle}
      defaultTo={d.to.join(', ')}
      defaultCc={d.cc.length ? d.cc.join(', ') : undefined}
      defaultSubject={d.subjectHtml}
      defaultBody={d.bodyHtml}
      initialDraft={d}
    />
    </Suspense>
  );
}
