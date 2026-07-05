import { Module } from '@nestjs/common';
import { KafkaModule } from './kafka/kafka.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [KafkaModule, DatabaseModule],
  exports: [KafkaModule, DatabaseModule],
})
export class SharedModule {}
