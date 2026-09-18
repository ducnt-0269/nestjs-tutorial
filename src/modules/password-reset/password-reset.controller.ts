import { Body, Controller, HttpCode, Post, Put } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { NoStore } from '../../common/decorators/no-store.decorator.js';
import { fieldBody } from '../../common/errors/api-error.js';
import {
  BLANK_MESSAGE,
  INVALID_MESSAGE,
} from '../../common/errors/messages.js';

import {
  type RequestPasswordResetBody,
  requestPasswordResetSchema,
  type SpendPasswordResetBody,
  spendPasswordResetSchema,
} from './password-reset.schema.js';
import { PasswordResetService } from './password-reset.service.js';

@ApiTags('users')
@Controller('users/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post()
  // 202 rather than 204: what this answers is that the request was taken, not
  // that the mail has gone out. The sending happens after the response, and
  // may yet be retried.
  @HttpCode(202)
  @ApiOperation({ summary: 'Request a password reset link by email' })
  @ApiAcceptedResponse()
  @ApiUnprocessableEntityResponse({
    schema: { example: fieldBody('email', BLANK_MESSAGE) },
  })
  @NoStore()
  request(
    @Body({ schema: requestPasswordResetSchema })
    body: RequestPasswordResetBody,
  ): Promise<void> {
    return this.passwordResetService.request(body.user.email);
  }

  @Put()
  // The password is changed and the token is gone; there is nothing left to
  // answer with, and nothing here signs the caller in.
  @HttpCode(204)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiNoContentResponse()
  @ApiUnprocessableEntityResponse({
    schema: { example: fieldBody('token', INVALID_MESSAGE) },
  })
  @NoStore()
  spend(
    @Body({ schema: spendPasswordResetSchema }) body: SpendPasswordResetBody,
  ): Promise<void> {
    return this.passwordResetService.spend(body.user.token, body.user.password);
  }
}
