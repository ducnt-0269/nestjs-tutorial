import { z } from 'zod';

import { BLANK_MESSAGE } from '../../common/errors/messages.js';
import { emailSchema, newPasswordSchema } from '../users/users.schema.js';

export const requestPasswordResetSchema = z.object({
  user: z.object({ email: emailSchema }, { error: BLANK_MESSAGE }),
});

// The password rule is the one registration applies, imported rather than
// restated, so the two can never drift into refusing different things. It runs
// at the boundary, which is what leaves the token untouched when it refuses.
export const spendPasswordResetSchema = z.object({
  user: z.object(
    {
      token: z.string({ error: BLANK_MESSAGE }).min(1, BLANK_MESSAGE),
      password: newPasswordSchema,
    },
    { error: BLANK_MESSAGE },
  ),
});

export type RequestPasswordResetBody = z.infer<
  typeof requestPasswordResetSchema
>;
export type SpendPasswordResetBody = z.infer<typeof spendPasswordResetSchema>;
