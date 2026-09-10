import { z } from 'zod';

const blank = "can't be blank";

export const registerSchema = z.object({
  user: z.object(
    {
      username: z.string({ error: blank }).trim().min(1, blank),
      // Postgres unique indexes are case-sensitive. Lower-casing at the
      // boundary keeps Jake@x.com and jake@x.com one account, and login
      // shares this rule so the two never disagree.
      email: z
        .email({
          error: (issue) => (issue.input === undefined ? blank : 'is invalid'),
        })
        .toLowerCase(),
      // bcrypt ignores everything past 72 bytes, so a longer password would
      // hash the same as its prefix without anyone noticing.
      password: z
        .string({ error: blank })
        .min(8, 'must be at least 8 characters long')
        .max(72, 'must be at most 72 characters long'),
    },
    { error: blank },
  ),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type RegisterInput = RegisterBody['user'];
