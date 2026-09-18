import { z } from 'zod';

import {
  BLANK_MESSAGE,
  INVALID_MESSAGE,
} from '../../common/errors/messages.js';
import { INT4_MAX } from '../../prisma/prisma.constants.js';
import { publicProfileSchema } from '../users/users.schema.js';

import { DEFAULT_LIMIT, MAX_LIMIT } from './articles.constants.js';

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

// Same rule as the content fields: a tag that is whitespace alone is not a
// tag. The rule sits on the array rather than on each entry, so the error
// names the field the caller sent instead of the position inside it.
// Repeats inside one request collapse here, which is what keeps the join rows
// unique without the database having to refuse the write.
const tagListField = z
  .array(z.string({ error: BLANK_MESSAGE }).trim(), { error: INVALID_MESSAGE })
  .refine((names) => names.every((name) => name.length > 0), BLANK_MESSAGE)
  .default([])
  .transform((names) => [...new Set(names)]);

export const createArticleSchema = z.object({
  // Declared here rather than on the shared fields, because the update schema
  // is built from those: the spec hands an article its tags once, at creation.
  article: articleFields.extend({ tagList: tagListField }),
});

// Every field optional on the way in: one left out keeps its current value,
// because Prisma reads the resulting undefined as "leave this column alone".
// Defaulted rather than optional so a body of {} arrives as a no-op.
export const updateArticleSchema = z.object({
  article: articleFields.partial().default({}),
});

const pageField = (fallback: number, ceiling: number) =>
  z.coerce
    .number({ error: INVALID_MESSAGE })
    .int(INVALID_MESSAGE)
    .min(0, INVALID_MESSAGE)
    .max(ceiling, INVALID_MESSAGE)
    .default(fallback);

export const listArticlesQuerySchema = z.object({
  // A repeated query parameter arrives as an array, which the bare rule answers
  // in Zod's own wording rather than from the vocabulary §4 allows.
  author: z
    .string({ error: INVALID_MESSAGE })
    .describe('Filter on username')
    .optional(),
  tag: z
    .string({ error: INVALID_MESSAGE })
    .describe('Filter on tag name')
    .optional(),
  limit: pageField(DEFAULT_LIMIT, MAX_LIMIT),
  offset: pageField(0, INT4_MAX),
});

export type CreateArticleBody = z.infer<typeof createArticleSchema>;
export type CreateArticleInput = CreateArticleBody['article'];
export type UpdateArticleBody = z.infer<typeof updateArticleSchema>;
export type UpdateArticleInput = UpdateArticleBody['article'];
export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;

// Allowlist (§5): the row carries an id and an author id, and neither is
// declared here, so neither leaves the API.
const articleShape = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  body: z.string(),
  tagList: z.array(z.string()),
  // Prisma answers with a Date. Converting here is what puts milliseconds in
  // the response; declaring these as strings would make the serializer throw.
  createdAt: z.date().transform((at) => at.toISOString()),
  updatedAt: z.date().transform((at) => at.toISOString()),
  author: publicProfileSchema,
});

export const articleResponseSchema = articleShape.transform((article) => ({
  article,
}));

// The single shape minus the body, so a field added to one is a field the other
// has to answer for.
export const articlesResponseSchema = z.object({
  articles: z.array(articleShape.omit({ body: true })),
  articlesCount: z.number(),
});

export const articleResponseExample = {
  article: {
    slug: 'how-to-train-your-dragon-a3f91c7d',
    title: 'How to train your dragon',
    description: 'Ever wonder how?',
    body: 'It takes a lot of patience.',
    tagList: ['dragons', 'training'],
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:00:00.000Z',
    author: { username: 'jake', bio: null, image: null },
  },
};

export const articlesResponseExample = {
  articles: [
    {
      slug: 'how-to-train-your-dragon-a3f91c7d',
      title: 'How to train your dragon',
      description: 'Ever wonder how?',
      tagList: ['dragons', 'training'],
      createdAt: '2026-09-16T08:00:00.000Z',
      updatedAt: '2026-09-16T08:00:00.000Z',
      author: { username: 'jake', bio: null, image: null },
    },
  ],
  articlesCount: 1,
};
