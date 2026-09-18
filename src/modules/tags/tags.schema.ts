import { z } from 'zod';

export const tagsResponseSchema = z.object({ tags: z.array(z.string()) });

export const tagsResponseExample = { tags: ['dragons', 'training'] };
