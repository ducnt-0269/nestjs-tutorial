import { z } from 'zod';

const blank = "can't be blank";

// Postgres unique indexes are case-sensitive. Lower-casing at the boundary
// keeps Jake@x.com and jake@x.com one account; registration and signing in
// share the rule so the two can never disagree.
const email = z
  .email({
    error: (issue) => (issue.input === undefined ? blank : 'is invalid'),
  })
  .toLowerCase();

export const registerSchema = z.object({
  user: z.object(
    {
      username: z.string({ error: blank }).trim().min(1, blank),
      email,
      // bcrypt ignores everything past 72 *bytes*, so a longer password would
      // hash the same as its prefix without anyone noticing. Counted in bytes,
      // not characters: `.max()` would let 36 × 'é' plus anything through.
      password: z
        .string({ error: blank })
        .min(8, 'must be at least 8 characters long')
        .refine(
          (value) => Buffer.byteLength(value, 'utf8') <= 72,
          'must be at most 72 bytes long',
        ),
    },
    { error: blank },
  ),
});

export const loginSchema = z.object({
  user: z.object(
    {
      email,
      // Presence only. Registration owns the length rule; repeating it here
      // would answer differently for a password that is merely too short.
      password: z.string({ error: blank }).min(1, blank),
    },
    { error: blank },
  ),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type RegisterInput = RegisterBody['user'];
export type LoginBody = z.infer<typeof loginSchema>;
export type LoginInput = LoginBody['user'];
