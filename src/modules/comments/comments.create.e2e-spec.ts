import { beforeEach, describe, expect, it } from 'vitest';

import { type Actor, useCommentsHarness } from './comments.e2e.fixture.js';

describe('POST /api/articles/:slug/comments', () => {
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

  it('stores the comment and answers with it', async () => {
    const response = await harness
      .postComment(
        slug,
        {
          // The body names someone else on purpose. Nothing in it decides who
          // the comment belongs to, and the response is where that shows.
          comment: { body: 'It takes a Jacobian.', author: 'mallory' },
        },
        author.token,
      )
      .expect(201);

    expect(response.body).toEqual({
      comment: {
        id: expect.any(Number),
        body: 'It takes a Jacobian.',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        author: { username: 'jake', bio: null, image: null },
      },
    });

    const stored = await harness.prisma().comment.findUniqueOrThrow({
      where: { id: response.body.comment.id as number },
    });

    expect(stored.body).toBe('It takes a Jacobian.');
    expect(stored.authorId).toBe(author.id);
  });

  it('rejects a blank body with a 422', async () => {
    const response = await harness
      .postComment(slug, { comment: { body: '   ' } }, author.token)
      .expect(422);

    expect(response.body).toEqual({ errors: { body: ["can't be blank"] } });
    expect(await harness.prisma().comment.count()).toBe(0);
  });

  it('answers a 404 when no article carries the slug', async () => {
    const response = await harness
      .postComment(
        'nothing-here-00000000',
        { comment: { body: 'Into the void.' } },
        author.token,
      )
      .expect(404);

    expect(response.body).toEqual({ errors: { article: ['not found'] } });
  });

  it('answers a 401 when the caller is signed out', async () => {
    const response = await harness
      .postComment(slug, { comment: { body: 'Anonymously.' } }, null)
      .expect(401);

    expect(response.body).toEqual({ errors: { token: ['is invalid'] } });
    expect(await harness.prisma().comment.count()).toBe(0);
  });
});
