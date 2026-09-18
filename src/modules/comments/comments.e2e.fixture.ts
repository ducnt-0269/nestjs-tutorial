import { useApiHarness } from '../../testing/e2e-harness.fixture.js';

export type { Actor } from '../../testing/e2e-harness.fixture.js';

/**
 * The request helpers the three comment suites need, on top of the shared
 * harness. Only the routes belong here; the application, the database and the
 * accounts are the harness's business.
 *
 * Publishing an article is part of it because a comment has nowhere to live
 * without one. It moves to the shared harness the day an article suite wants
 * it too, and not before.
 */
export function useCommentsHarness() {
  const { http, authorize, ...harness } = useApiHarness();

  return {
    ...harness,

    createArticle: async (token: string, title: string): Promise<string> => {
      const response = await http()
        .post('/api/articles')
        .set('Authorization', `Token ${token}`)
        .send({
          article: { title, description: 'A description', body: 'A body' },
        })
        .expect(201);

      return response.body.article.slug as string;
    },

    articleIdFor: async (slug: string): Promise<number> =>
      (await harness.prisma().article.findUniqueOrThrow({ where: { slug } }))
        .id,

    postComment: (slug: string, body: object, token: string | null) =>
      authorize(http().post(`/api/articles/${slug}/comments`), token).send(
        body,
      ),

    getComments: (slug: string) => http().get(`/api/articles/${slug}/comments`),

    deleteComment: (slug: string, id: number | string, token: string | null) =>
      authorize(http().delete(`/api/articles/${slug}/comments/${id}`), token),
  };
}
