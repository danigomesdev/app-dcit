import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Default express JSON body limit (100kb) is far too small for a
  // base64-encoded atestado photo — raise it just for this app.
  app.useBodyParser('json', { limit: '10mb' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
