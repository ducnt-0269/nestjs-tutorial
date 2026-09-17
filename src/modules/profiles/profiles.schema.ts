import { publicProfileSchema } from '../users/users.schema.js';

export const profileResponseSchema = publicProfileSchema.transform(
  (profile) => ({
    profile,
  }),
);

export const profileResponseExample = {
  profile: { username: 'jake', bio: null, image: null },
};
