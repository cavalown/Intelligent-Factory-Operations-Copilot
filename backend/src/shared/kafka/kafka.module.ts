import { Global, Module } from '@nestjs/common';
import { KAFKA_CLIENT, KafkaClientProvider } from './kafka-client.provider';
import { KafkaProducerService } from './kafka-producer.service';

@Global()
@Module({
  providers: [KafkaClientProvider, KafkaProducerService],
  exports: [KAFKA_CLIENT, KafkaProducerService],
})
export class KafkaModule {}
