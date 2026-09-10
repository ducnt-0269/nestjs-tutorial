import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

export class EnvironmentValidationError extends Error {
  constructor(details: string) {
    super(`Invalid environment configuration: ${details}`);
    this.name = 'EnvironmentValidationError';
  }
}

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  // A bare @IsString would accept "localhost:5432" and defer the failure to
  // PrismaPg at startup; checking the protocol catches it here.
  @IsUrl({
    protocols: ['postgresql', 'postgres'],
    require_protocol: true,
    require_tld: false,
  })
  DATABASE_URL!: string;

  @IsUrl({
    protocols: ['redis', 'rediss'],
    require_protocol: true,
    require_tld: false,
  })
  REDIS_URL!: string;
}

/**
 * Runs at startup. Any missing or malformed variable aborts the process here
 * rather than surfacing as an obscure failure deeper in the request path.
 */
export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new EnvironmentValidationError(details);
  }

  return parsed;
}
