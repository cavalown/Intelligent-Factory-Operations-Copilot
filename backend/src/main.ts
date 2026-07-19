// Must load before any other import — see instrumentation.ts's own header
// comment for why (auto-instrumentation requires this order).
import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // docs/design/api.md §2.1 — the contract base URL is http://localhost:3000/api.
  app.setGlobalPrefix('api');
  // Open CORS matches the MVP's no-auth posture (api.md §2.6); the Vite dev
  // server on :5173 calls the API on :3000 cross-origin.
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
