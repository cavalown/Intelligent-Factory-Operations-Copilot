import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { env } from '../config/env.config';

@Module({
  imports: [MongooseModule.forRoot(env.mongodbUri)],
  exports: [MongooseModule],
})
export class DatabaseModule {}
