import { z } from 'zod';

import { BLANK_MESSAGE } from '../../common/errors/messages.js';
import { publicProfileSchema } from '../users/users.schema.js';

// Same rule the article content fields carry: present, and not whitespace alone.
const bodyField = z
  .string({ error: BLANK_MESSAGE })
  .trim()
  .min(1, BLANK_MESSAGE);

const commentFields = z.object(
  { body: bodyField },
  // Without this the root key answers with Zod's own wording, and the same
  // mistake on an article already answers with the project's.
  { error: BLANK_MESSAGE },
);

export const createCommentSchema = z.object({ comment: commentFields });

export type CreateCommentBody = z.infer<typeof createCommentSchema>;
export type CreateCommentInput = CreateCommentBody['comment'];

// Allowlist (§5). Unlike an article this declares the id, because deleting a
// comment addresses it by that id and a hidden one makes the route unusable.
// The article id and the author id stay undeclared, so neither leaves the API.
const commentShape = z.object({
  id: z.number(),
  body: z.string(),
  // Prisma answers with a Date. Converting here is what puts milliseconds in
  // the response; declaring these as strings would make the serializer throw.
  createdAt: z.date().transform((at) => at.toISOString()),
  updatedAt: z.date().transform((at) => at.toISOString()),
  author: publicProfileSchema,
});

export const commentResponseSchema = commentShape.transform((comment) => ({
  comment,
}));

// A single comment wraps itself, the way an article does. A list cannot: the
// serializer walks an array response element by element, so a schema declared
// as an array is never handed the array. The controller assembles the envelope
// and this schema validates the assembled object whole.
export const commentsResponseSchema = z.object({
  comments: z.array(commentShape),
});

const exampleComment = {
  id: 1,
  body: 'It takes a Jacobian.',
  createdAt: '2026-09-17T08:00:00.000Z',
  updatedAt: '2026-09-17T08:00:00.000Z',
  author: { username: 'jake', bio: null, image: null },
};

export const commentResponseExample = { comment: exampleComment };
export const commentsResponseExample = { comments: [exampleComment] };
