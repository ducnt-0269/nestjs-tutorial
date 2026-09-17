import { z } from 'zod';
import { blank, invalid } from '../../common/errors/messages.js';

// The rules below describe an account rather than the act of registering, so they
// live with the module that owns the account; auth and the update endpoint reuse them.

// Postgres unique indexes are case-sensitive. Lower-casing at the boundary
// keeps Jake@x.com and jake@x.com one account; registration and signing in
// share the rule so the two can never disagree.
export const emailSchema = z
  .email({
    error: (issue) => (issue.input === undefined ? blank : invalid),
  })
  .toLowerCase();

export const usernameSchema = z.string({ error: blank }).trim().min(1, blank);

// bcrypt ignores everything past 72 *bytes*, so a longer password would
// hash the same as its prefix without anyone noticing. Counted in bytes,
// not characters: `.max()` would let 36 × 'é' plus anything through.
export const newPasswordSchema = z
  .string({ error: blank })
  .min(8, 'must be at least 8 characters long')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'must be at most 72 bytes long',
  );

// Every field optional: one absent from the body keeps its current value, and
// Prisma reads the resulting `undefined` as "leave this column alone". An
// explicit null clears bio or image, which is the only way to empty them.
const updateFields = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  password: newPasswordSchema.optional(),
  bio: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

// Defaulted rather than optional, so a body of {} arrives as a no-op instead of
// leaving every caller to supply the empty object itself.
export const updateUserSchema = z.object({ user: updateFields.default({}) });

export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type UpdateUserInput = UpdateUserBody['user'];

// Allowlist: fields absent here never leave the API (§5).
export const userResponseSchema = z
  .object({
    email: z.string(),
    username: z.string(),
    bio: z.string().nullable(),
    image: z.string().nullable(),
    token: z.string(),
  })
  .transform((user) => ({ user }));

export const userResponseExample = {
  user: {
    email: 'jake@example.com',
    username: 'jake',
    bio: null,
    image: null,
    token: '<jwt>',
  },
};
