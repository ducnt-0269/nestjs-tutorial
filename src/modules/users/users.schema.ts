import { z } from 'zod';

// The rules describe an account, not the act of registering, so they live with
// the module that owns the account; auth and the update endpoint both reuse them.
export const blank = "can't be blank";

// Postgres unique indexes are case-sensitive. Lower-casing at the boundary
// keeps Jake@x.com and jake@x.com one account; registration and signing in
// share the rule so the two can never disagree.
export const emailSchema = z
  .email({
    error: (issue) => (issue.input === undefined ? blank : 'is invalid'),
  })
  .toLowerCase();

export const usernameSchema = z.string({ error: blank }).trim().min(1, blank);

// bcrypt ignores everything past 72 *bytes*, so a longer password would
// hash the same as its prefix without anyone noticing. Counted in bytes,
// not characters: `.max()` would let 36 × 'é' plus anything through.
export const passwordSchema = z
  .string({ error: blank })
  .min(8, 'must be at least 8 characters long')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'must be at most 72 bytes long',
  );

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
