/**
 * The reserved line above a public reference form's submit button (§5, §7): empty
 * until a send fails, then one plain sentence, never a server message. A failure
 * that may pass on a second try reads "Couldn't send · Try again".
 */
export type SubmitError = { text: string; retry?: boolean } | null

export function SubmitErrorLine({
  error,
  onRetry,
  retrying,
}: {
  error: SubmitError
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <p
      role="alert"
      className="gio-field-message font-inter"
      data-state={error ? 'error' : undefined}
      key={error?.text}
      style={{ fontSize: 12.5, color: '#C2372B', margin: 0 }}
    >
      {error?.text}
      {error?.retry && onRetry && (
        <>
          {' · '}
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="font-inter font-medium underline underline-offset-2 disabled:opacity-60"
            style={{ color: 'inherit', fontSize: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
          >
            Try again
          </button>
        </>
      )}
    </p>
  )
}
