import { randomBytes } from 'node:crypto';

// A title carries no length limit, but a Postgres btree entry does, so the
// readable half of the slug is cut long before it can reach that ceiling.
const BASE_MAX_LENGTH = 80;
// A clash needs two writers to hit the same title and the same suffix, so four
// bytes already sit far past anything this data set can reach.
const SUFFIX_BYTES = 4;

// The random suffix is what makes two articles under one title legal: a repeat
// is improbable rather than impossible, so nothing has to look for a free slug
// and two concurrent writers never wait on each other. The unique index is
// what catches the rare repeat, as a conflict.
export function slugFor(title: string): string {
  const base = title
    .normalize('NFD')
    // NFD splits an accent off into a combining mark, which this drops. The
    // Vietnamese letter d with stroke is a letter of its own and survives NFD
    // untouched, so it is mapped by hand or the word loses it.
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, BASE_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
  const suffix = randomBytes(SUFFIX_BYTES).toString('hex');

  // A title made only of emoji or of Han characters leaves nothing readable
  // behind; the suffix alone still answers, and never opens with a dash.
  return base ? `${base}-${suffix}` : suffix;
}
