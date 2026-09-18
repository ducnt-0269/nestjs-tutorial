import { z } from 'zod';

import { BLANK_MESSAGE } from '../../common/errors/messages.js';
import {
  emailSchema,
  newPasswordSchema,
  usernameSchema,
} from '../users/users.schema.js';

export const registerSchema = z.object({
  user: z.object(
    {
      username: usernameSchema,
      email: emailSchema,
      password: newPasswordSchema,
    },
    { error: BLANK_MESSAGE },
  ),
});

export const loginSchema = z.object({
  user: z.object(
    {
      email: emailSchema,
      // Presence only: the length rule belongs to registration.
      password: z.string({ error: BLANK_MESSAGE }).min(1, BLANK_MESSAGE),
    },
    { error: BLANK_MESSAGE },
  ),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type RegisterInput = RegisterBody['user'];
export type LoginBody = z.infer<typeof loginSchema>;
export type LoginInput = LoginBody['user'];
