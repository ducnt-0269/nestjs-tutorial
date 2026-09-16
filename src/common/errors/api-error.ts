import { NotFoundException, UnauthorizedException } from '@nestjs/common';

export interface ErrorsBody {
  errors: Record<string, string[]>;
}

export type Resource = 'user' | 'profile';

export function errorsBody(errors: Record<string, string[]>): ErrorsBody {
  return { errors };
}

export const fieldBody = (field: string, message: string): ErrorsBody =>
  errorsBody({ [field]: [message] });

export const invalidTokenBody = errorsBody({ token: ['is invalid'] });
export const invalidCredentialsBody = errorsBody({
  credentials: ['are invalid'],
});
export const notFoundBody = (resource: Resource) =>
  errorsBody({ [resource]: ['not found'] });
export const requestErrorBody = (message: string) =>
  errorsBody({ request: [message] });
export const internalErrorBody = errorsBody({ server: ['internal error'] });

export const invalidToken = () => new UnauthorizedException(invalidTokenBody);

export const invalidCredentials = () =>
  new UnauthorizedException(invalidCredentialsBody);

export const notFound = (resource: Resource) =>
  new NotFoundException(notFoundBody(resource));
