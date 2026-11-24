import { lazy, Suspense, useSyncExternalStore } from 'react';
import { clearRestored, getRestoredAll, subscribeRestored } from '@/lib/emailOutbox';

/**
 * Undo Send (2026-11-11): reopens a draft after Undo or "Open draft", wherever you are
 * now, even when the page that wrote it has closed. Since 2026-11-24 it also keeps a
 * draft whose page went away while it was open (you minimized it and moved on): it
 * comes back here, minimized, as it was. Mounted once in App.tsx; the composer (and its
 * editor) loads only when a draft comes back.
 */
const MinimizableEmailComposer = lazy(() =>
  import('@/components/candidates/MinimizableEmailComposer').then((m) => ({ default: m.MinimizableEmailComposer })),
);
export function EmailOutboxHost() {
  const restored = useSyncExternalStore(subscribeRestored, getRestoredAll, getRestoredAll);
  if (!restored.length) return null;
  return (
    <Suspense fallback={null}>
      {restored.map(({ key, draft: d, minimized }) => (
        <MinimizableEmailComposer
          key={key}
          isOpen
          onOpenChange={(open) => !open && clearRestored(key)}
          // This is where drafts end up: it never hands one on again.
          keepOnUnmount={false}
          startMinimized={minimized}
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
      ))}
    </Suspense>
  );
}
