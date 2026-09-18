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

  // HS256 needs a key of at least 256 bits (RFC 7518 §3.2); 32 characters
  // is the floor this check can enforce on a string.
  JWT_SECRET: z.string().min(32),
  // Seconds rather than "7d": jsonwebtoken types its duration strings as a
  // template literal that a plain string from the environment cannot satisfy.
  JWT_TTL_SECONDS: z.coerce.number().int().positive(),

  // Comma-separated origins allowed to call the API from a browser. Parsed
  // here so main.ts receives a list and every entry is a real URL.
  CORS_ORIGIN: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.url()).min(1)),

  // Protocol and hostname checked for the same reason as the database URL:
  // a bare string defers the failure to the first SDK call. A trailing slash is
  // dropped because it would otherwise compose a doubled separator, which the
  // storage service answers with a bad request rather than a missing key.
  S3_ENDPOINT: z
    .url({ protocol: /^https?$/, hostname: /.+/ })
    .transform((value) => value.replace(/\/+$/, '')),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  // The storage server used in development ignores this value, but the SDK
  // requires one to be present.
  S3_REGION: z.string().min(1),
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
