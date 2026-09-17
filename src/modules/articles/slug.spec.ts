import { describe, expect, it } from 'vitest';
import { slugFor } from './slug.js';

describe('slugFor', () => {
  it('derives the slug from the title', () => {
    expect(slugFor('How to train your dragon')).toMatch(
      /^how-to-train-your-dragon-[0-9a-f]{8}$/,
    );
  });

  it('keeps Vietnamese letters readable', () => {
    expect(slugFor('Đường về nhà')).toMatch(/^duong-ve-nha-[0-9a-f]{8}$/);
  });

  it('collapses punctuation and trims the edges', () => {
    expect(slugFor('  Hello,   World!!  ')).toMatch(
      /^hello-world-[0-9a-f]{8}$/,
    );
  });

  it('answers with the suffix alone when nothing readable is left', () => {
    expect(slugFor('🎉🎉')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('cuts a long title down to a length an index can hold', () => {
    expect(slugFor('x'.repeat(500))).toHaveLength(89);
  });

  it('answers differently for the same title twice', () => {
    const title = 'How to train your dragon';

    expect(slugFor(title)).not.toBe(slugFor(title));
  });
});
