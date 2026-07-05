import { Kafka } from 'kafkajs';
import { env } from '../config/env.config';

export const KAFKA_CLIENT = Symbol('KAFKA_CLIENT');

export const KafkaClientProvider = {
  provide: KAFKA_CLIENT,
  useFactory: (): Kafka =>
    new Kafka({
      clientId: 'ifoc-backend',
      brokers: env.kafkaBrokers,
    }),
};
