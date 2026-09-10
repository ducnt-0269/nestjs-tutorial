import { z } from 'zod';

/**
 * Response shape of the user resource. The serializer interceptor parses
 * every user response through this, so it is an allowlist: a field absent
 * here never leaves the API, and the `user` envelope is applied in one place
 * (docs/system-architecture.md §6.3).
 */
export const userResponseSchema = z
  .object({
    email: z.string(),
    username: z.string(),
    bio: z.string().nullable(),
    image: z.string().nullable(),
    token: z.string(),
  })
  .transform((user) => ({ user }));
