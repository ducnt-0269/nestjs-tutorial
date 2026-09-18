import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { INVALID_MESSAGE } from './messages.js';

export interface ErrorsBody {
  errors: Record<string, string[]>;
}

export type Resource = 'user' | 'profile' | 'article' | 'comment';

export function errorsBody(errors: Record<string, string[]>): ErrorsBody {
  return { errors };
}

export const fieldBody = (field: string, message: string): ErrorsBody =>
  errorsBody({ [field]: [message] });

export const invalidTokenBody = errorsBody({ token: [INVALID_MESSAGE] });
export const invalidCredentialsBody = errorsBody({
  credentials: ['are invalid'],
});
export const notFoundBody = (resource: Resource) =>
  errorsBody({ [resource]: ['not found'] });
export const forbiddenBody = (resource: Resource) =>
  errorsBody({ [resource]: ['forbidden'] });
export const requestErrorBody = (message: string) =>
  errorsBody({ request: [message] });
export const internalErrorBody = errorsBody({ server: ['internal error'] });

export const invalidToken = () => new UnauthorizedException(invalidTokenBody);

export const invalidCredentials = () =>
  new UnauthorizedException(invalidCredentialsBody);

export const notFound = (resource: Resource) =>
  new NotFoundException(notFoundBody(resource));

export const forbidden = (resource: Resource) =>
  new ForbiddenException(forbiddenBody(resource));
