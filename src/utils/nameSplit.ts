// Utilities to split a full name into first/last and recompose them.
// Designed to handle LATAM/Iberian names (1-2 given names + 1-2 surnames)
// as well as Anglo single-surname names and mononyms.

const PARTICLES = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'da',
  'do',
  'dos',
  'das',
  'van',
  'von',
  'der',
  'den',
  'di',
  'du',
  'le',
  'el',
  'al',
  'bin',
  'ibn',
  'mac',
  'mc',
  "o'",
  'st',
  'st.',
]);

const isParticle = (token: string) => PARTICLES.has(token.toLowerCase());

export function splitFullName(full?: string | null): { first: string; last: string } {
  const cleaned = (full ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { first: '', last: '' };

  const tokens = cleaned.split(' ');

  if (tokens.length === 1) return { first: tokens[0], last: '' };
  if (tokens.length === 2) return { first: tokens[0], last: tokens[1] };

  // 3 tokens: if a particle is present (anywhere after position 0),
  // treat the trailing 2 tokens as a compound surname ("Juan de la Cruz" would be 4,
  // but "Juan de Cruz" / "María del Río" lands here).
  if (tokens.length === 3) {
    if (isParticle(tokens[1])) {
      return { first: tokens[0], last: `${tokens[1]} ${tokens[2]}` };
    }
    // Default: assume LATAM pattern (1 first name + 2 surnames).
    return { first: tokens[0], last: `${tokens[1]} ${tokens[2]}` };
  }

  // 4+ tokens: assume LATAM pattern (2 first names + 2 surnames) as the
  // common case, then glue any particles forward into the surname so we
  // don't strand "de" / "van" on the first-name side.
  let splitAt = Math.floor(tokens.length / 2); // index where surname starts
  if (splitAt < 1) splitAt = 1;

  // Walk left while the token just before the split is a particle — those
  // belong to the surname.
  while (splitAt > 1 && isParticle(tokens[splitAt - 1])) {
    splitAt -= 1;
  }

  const first = tokens.slice(0, splitAt).join(' ');
  const last = tokens.slice(splitAt).join(' ');
  return { first, last };
}

export function composeFullName(first?: string | null, last?: string | null): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  return `${f} ${l}`.replace(/\s+/g, ' ').trim();
}
