import { z } from 'zod';
import { BLANK_MESSAGE } from '../../common/errors/messages.js';
import { profileFields } from '../profiles/profiles.schema.js';

// One rule for all three content fields: present, and not whitespace alone.
// Same shape as the username rule, so an empty string is rejected rather than
// quietly stored.
const contentField = z
  .string({ error: BLANK_MESSAGE })
  .trim()
  .min(1, BLANK_MESSAGE);

const articleFields = z.object(
  {
    title: contentField,
    description: contentField,
    body: contentField,
  },
  // Without this the root key answers with Zod's own wording, and the same
  // mistake on registration already answers with the project's.
  { error: BLANK_MESSAGE },
);

export const createArticleSchema = z.object({ article: articleFields });

// Every field optional on the way in: one left out keeps its current value,
// because Prisma reads the resulting undefined as "leave this column alone".
// Defaulted rather than optional so a body of {} arrives as a no-op.
export const updateArticleSchema = z.object({
  article: articleFields.partial().default({}),
});

export type CreateArticleBody = z.infer<typeof createArticleSchema>;
export type CreateArticleInput = CreateArticleBody['article'];
export type UpdateArticleBody = z.infer<typeof updateArticleSchema>;
export type UpdateArticleInput = UpdateArticleBody['article'];

// Allowlist (§5): the row carries an id and an author id, and neither is
// declared here, so neither leaves the API.
export const articleResponseSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    body: z.string(),
    // Prisma answers with a Date. Converting here is what puts milliseconds in
    // the response; declaring these as strings would make the serializer throw.
    createdAt: z.date().transform((at) => at.toISOString()),
    updatedAt: z.date().transform((at) => at.toISOString()),
    // The public profile shape, owned by the profiles module and reused whole.
    author: profileFields,
  })
  .transform((article) => ({ article }));

export const articleResponseExample = {
  article: {
    slug: 'how-to-train-your-dragon-a3f91c7d',
    title: 'How to train your dragon',
    description: 'Ever wonder how?',
    body: 'It takes a lot of patience.',
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:00:00.000Z',
    author: { username: 'jake', bio: null, image: null },
  },
};
