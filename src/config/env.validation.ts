import { z } from 'zod';

export class EnvironmentValidationError extends Error {
  constructor(details: string) {
    super(`Invalid environment configuration: ${details}`);
    this.name = 'EnvironmentValidationError';
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),

  // Every process.env value is a string, so numeric variables need coercion.
  PORT: z.coerce.number().int().min(1).max(65535),

  // A bare string would accept "localhost:5432" and defer the failure to
  // PrismaPg at startup; checking the protocol catches it here. The hostname
  // has to be checked too: z.url() accepts "redis:///0", which ioredis then
  // resolves to localhost rather than rejecting.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, hostname: /.+/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/, hostname: /.+/ }),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

/**
 * Runs at startup. Any missing or malformed variable aborts the process here
 * rather than surfacing as an obscure failure deeper in the request path.
 */
export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new EnvironmentValidationError(details);
  }

  return result.data;
}
