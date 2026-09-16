import { z } from 'zod';

// Allowlist, same rule as the account response (§5): the email and the token
// belong to the owner of the account, never to a public reader of it.
export const profileFields = z.object({
  username: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
});

export const profileResponseSchema = profileFields.transform((profile) => ({
  profile,
}));

export const profileResponseExample = {
  profile: { username: 'jake', bio: null, image: null },
};
