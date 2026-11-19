import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SqlExceptionFilter } from './common/filters/sql-exception.filter';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalFilters(new SqlExceptionFilter());

  const port = Number(process.env.PORT_API || 4000);
  await app.listen(port);
  console.log(
    `[NestJS Backend] Multi-Vendor E-Commerce API listening on http://localhost:${port}/api`,
  );
}

bootstrap();
