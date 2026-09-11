import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Response } from 'express';
import { AppModule } from './app.module.js';
import { TOKEN_SCHEME } from './common/guards/jwt-auth.guard.js';

// The leading slash matters: Nest mounts its 404 handler with
// `express.use(prefix, ...)` verbatim, and Express 5 never matches a mount
// path without one, so every unknown route would bypass the exception filter.
const API_PREFIX = '/api';
const DOCS_PATH = `${API_PREFIX}/docs`;
const OPENAPI_JSON_PATH = `${DOCS_PATH}-json`;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string[]>('CORS_ORIGIN'),
  });
  // Lets PrismaService and RedisService close their connections on SIGTERM.
  app.enableShutdownHooks();

  const documentConfig = new DocumentBuilder()
    .setTitle('Medium Clone API')
    .setDescription('Backend API implementing the RealWorld specification')
    .setVersion('1.0')
    // The scheme is Token, not Bearer, so OpenAPI models it as an apiKey.
    .addApiKey(
      { type: 'apiKey', name: 'Authorization', in: 'header' },
      TOKEN_SCHEME,
    )
    .build();

  // @nestjs/swagger builds the OpenAPI document from the decorators; Scalar only
  // renders it. SwaggerModule.setup() is not called, so Swagger UI is not served
  // and neither is the -json route it would have added.
  const document = SwaggerModule.createDocument(app, documentConfig);

  app.use(DOCS_PATH, apiReference({ content: document }));
  app
    .getHttpAdapter()
    .get(OPENAPI_JSON_PATH, (_request: unknown, response: Response) =>
      response.json(document),
    );

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
