import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';

@ApiTags('hello')
@Controller('hello')
export class HelloController {
  constructor(private readonly i18n: I18nService) {}

  @Get()
  @ApiOperation({ summary: 'Return a greeting in the requested language' })
  @ApiOkResponse({ schema: { example: { message: 'Hello, world!' } } })
  greet(): { message: string } {
    // Language comes from the Accept-Language header, resolved by nestjs-i18n.
    return { message: this.i18n.t('hello.greeting') };
  }
}
