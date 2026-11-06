import { normalizePlaceholderKey } from '@/utils/templateUtils';

/**
 * The variables in a template's subject or body (2026-11-06): `{{key}}` text and pill
 * spans alike, keys normalised. Used to check that Rewrite with Gio kept them.
 */
export function templateTags(text: string): Set<string> {
  const keys = new Set<string>();
  for (const m of (text || '').matchAll(/data-placeholder="([^"]+)"/g)) keys.add(normalizePlaceholderKey(m[1]));
  for (const m of (text || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) keys.add(normalizePlaceholderKey(m[1]));
  return keys;
}

/** What a rewrite left out, and what it added that this email doesn't fill in. */
export function tagDiff(before: string, after: string, allowed: string[] | null) {
  const was = templateTags(before);
  const now = templateTags(after);
  const ok = allowed ? new Set(allowed.map(normalizePlaceholderKey)) : null;
  const dropped = [...was].filter((k) => !now.has(k));
  const invented = [...now].filter((k) => !was.has(k) && ok !== null && !ok.has(k));
  return { dropped, invented };
}

/** A body as the AI reads it: pills back to `{{key}}` text, the rest of the HTML kept. */
export function pillsToText(html: string): string {
  if (!html || !/<[a-z]/i.test(html)) return html || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('[data-placeholder]').forEach((el) => {
    el.replaceWith(doc.createTextNode(`{{${el.getAttribute('data-placeholder')}}}`));
  });
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) if (!(el.tagName === 'A' && a.name === 'href')) el.removeAttribute(a.name);
  });
  return doc.body.innerHTML;
}
