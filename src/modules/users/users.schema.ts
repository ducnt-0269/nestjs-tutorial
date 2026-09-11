import { z } from 'zod';

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
