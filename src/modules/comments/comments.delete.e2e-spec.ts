import { beforeEach, describe, expect, it } from 'vitest';

import { INT4_MAX } from '../../prisma/prisma.constants.js';

import { type Actor, useCommentsHarness } from './comments.e2e.fixture.js';

const commentNotFound = { errors: { comment: ['not found'] } };

describe('DELETE /api/articles/:slug/comments/:id', () => {
  const harness = useCommentsHarness();
  let author: Actor;
  let slug: string;
  let commentId: number;

  beforeEach(async () => {
    author = await harness.register('jake');
    slug = await harness.createArticle(
      author.token,
      'How to train your dragon',
    );
    const response = await harness
      .postComment(
        slug,
        { comment: { body: 'It takes a Jacobian.' } },
        author.token,
      )
      .expect(201);
    commentId = response.body.comment.id as number;
  });

  it('removes a comment of the caller', async () => {
    const response = await harness
      .deleteComment(slug, commentId, author.token)
      .expect(200);

    expect(response.body).toEqual({});

    const remaining = await harness.getComments(slug).expect(200);
    expect(remaining.body).toEqual({ comments: [] });
  });

  it('answers a 403 for a comment belonging to somebody else', async () => {
    const other = await harness.register('mallory');

    const response = await harness
      .deleteComment(slug, commentId, other.token)
      .expect(403);

    expect(response.body).toEqual({ errors: { comment: ['forbidden'] } });
    expect(await harness.prisma().comment.count()).toBe(1);
  });

  it('answers a 404 for a comment hanging off a different article', async () => {
    const otherSlug = await harness.createArticle(author.token, 'Another one');

    const response = await harness
      .deleteComment(otherSlug, commentId, author.token)
      .expect(404);

    expect(response.body).toEqual(commentNotFound);
    expect(await harness.prisma().comment.count()).toBe(1);
  });

  it('answers a 404 when no article carries the slug', async () => {
    const response = await harness
      .deleteComment('nothing-here-00000000', commentId, author.token)
      .expect(404);

    expect(response.body).toEqual({ errors: { article: ['not found'] } });
  });

  it('answers a 401 when the caller is signed out', async () => {
    const response = await harness
      .deleteComment(slug, commentId, null)
      .expect(401);

    expect(response.body).toEqual({ errors: { token: ['is invalid'] } });
    expect(await harness.prisma().comment.count()).toBe(1);
  });

  // A path segment is text and the column is a 32-bit integer, so every shape
  // below names a comment no row could carry. All four answer the same way as
  // one that was deleted a moment ago.
  it.each([
    ['an identifier no row carries', String(INT4_MAX - 1)],
    ['an identifier that is not digits', 'abc'],
    ['an identifier below the first one', '0'],
    ['an identifier past the width of the column', String(INT4_MAX + 1)],
  ])('answers a 404 for %s', async (_description, id) => {
    const response = await harness
      .deleteComment(slug, id, author.token)
      .expect(404);

    expect(response.body).toEqual(commentNotFound);
    expect(await harness.prisma().comment.count()).toBe(1);
  });
});
