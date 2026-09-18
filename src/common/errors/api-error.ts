import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { INVALID_MESSAGE } from './messages.js';

export interface ErrorsBody {
  errors: Record<string, string[]>;
}

export type Resource =
  | 'user'
  | 'profile'
  | 'article'
  | 'comment'
  | 'attachment';

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

// Spent, expired and never issued are deliberately one answer: a caller able
// to tell them apart could learn which tokens this system once handed out. The
// status is 422 rather than 401 because the token arrives in the body as a
// value being submitted, not as the credential the request is made under, which
// also puts the key in the Field group (§4) rather than the Credential one.
// Identical to the body beside it today, and built separately so that changing
// either does not silently move the other.
export const invalidResetToken = () =>
  new UnprocessableEntityException(fieldBody('token', INVALID_MESSAGE));

export const notFound = (resource: Resource) =>
  new NotFoundException(notFoundBody(resource));

export const forbidden = (resource: Resource) =>
  new ForbiddenException(forbiddenBody(resource));
