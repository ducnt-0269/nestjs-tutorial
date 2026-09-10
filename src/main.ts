import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const API_PREFIX = 'api';
const SWAGGER_PATH = `${API_PREFIX}/docs`;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(API_PREFIX);
  // Lets PrismaService and RedisService close their connections on SIGTERM.
  app.enableShutdownHooks();

  const documentConfig = new DocumentBuilder()
    .setTitle('Medium Clone API')
    .setDescription('Backend API implementing the RealWorld specification')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, () =>
    SwaggerModule.createDocument(app, documentConfig),
  );

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
