import { beforeEach, describe, expect, it } from 'vitest';

import { type Actor, useCommentsHarness } from './comments.e2e.fixture.js';

// Seeded rather than posted over HTTP. The column keeps milliseconds, so two
// comments created one after the other can land on the same instant, and the
// order this suite asserts would then be undefined rather than merely wrong.
const EARLIER = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-01-01T00:00:02.000Z');

describe('GET /api/articles/:slug/comments', () => {
  const harness = useCommentsHarness();
  let author: Actor;
  let slug: string;

  beforeEach(async () => {
    author = await harness.register('jake');
    slug = await harness.createArticle(
      author.token,
      'How to train your dragon',
    );
  });

  it('answers with the comments oldest first', async () => {
    const articleId = await harness.articleIdFor(slug);
    await harness.prisma().comment.createMany({
      // Written later first, so passing cannot come from the insertion order.
      data: [
        { body: 'Second', articleId, authorId: author.id, createdAt: LATER },
        { body: 'First', articleId, authorId: author.id, createdAt: EARLIER },
      ],
    });

    const response = await harness.getComments(slug).expect(200);

    expect(
      response.body.comments.map((comment: { body: string }) => comment.body),
    ).toEqual(['First', 'Second']);
    expect(response.body.comments[0]).toEqual({
      id: expect.any(Number),
      body: 'First',
      createdAt: EARLIER.toISOString(),
      updatedAt: expect.any(String),
      author: { username: 'jake', bio: null, image: null },
    });
  });

  it('answers with an empty list when nobody has commented', async () => {
    const response = await harness.getComments(slug).expect(200);

    expect(response.body).toEqual({ comments: [] });
  });

  it('answers a 404 when no article carries the slug', async () => {
    const response = await harness
      .getComments('nothing-here-00000000')
      .expect(404);

    expect(response.body).toEqual({ errors: { article: ['not found'] } });
  });
});
