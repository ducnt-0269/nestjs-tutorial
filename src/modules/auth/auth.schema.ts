import { z } from 'zod';
import {
  blank,
  emailSchema,
  passwordSchema,
  usernameSchema,
} from '../users/users.schema.js';

export const registerSchema = z.object({
  user: z.object(
    {
      username: usernameSchema,
      email: emailSchema,
      password: passwordSchema,
    },
    { error: blank },
  ),
});

export const loginSchema = z.object({
  user: z.object(
    {
      email: emailSchema,
      // Presence only: the length rule belongs to registration.
      password: z.string({ error: blank }).min(1, blank),
    },
    { error: blank },
  ),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type RegisterInput = RegisterBody['user'];
export type LoginBody = z.infer<typeof loginSchema>;
export type LoginInput = LoginBody['user'];
