import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// What the strategy puts on the request once a token verifies.
declare global {
  namespace Express {
    interface User {
      id: number;
      token: string;
    }
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Express.User => {
    // Only reachable behind the guard, which rejects a request without a caller.
    const request = context.switchToHttp().getRequest<Request>();
    return request.user as Express.User;
  },
);
