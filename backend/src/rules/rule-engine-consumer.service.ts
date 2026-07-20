import { Inject, Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { KafkaProducerService } from '../shared/kafka/kafka-producer.service';
import { env } from '../shared/config/env.config';
import { MachineEvent } from '../shared/types/machine-event.types';
import { MachinesService } from '../machines/machines.service';

// Rule Engine: computes, once, the two classification facts Machine Service
// and Alert Service used to independently re-derive (docs/design/machine-schema.md
// §5.4), and republishes every event to the enriched topic carrying them.
// Own consumer group per ai/rules/kafka-consumer-conventions.md.
// See openspec/changes/add-rule-engine/design.md D1/D2/D3.
@Injectable()
export class RuleEngineConsumerService extends KafkaConsumerBase {
  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    private readonly machinesService: MachinesService,
    private readonly kafkaProducerService: KafkaProducerService,
  ) {
    super(kafka, 'rules-service-group', env.kafkaTopicMachineEvents);
  }

  protected async handleMessage(event: MachineEvent): Promise<boolean> {
    let enrichedEvent: MachineEvent = event;
    // Whether this event was actually classified (or, for event types with
    // no classification to do, whether republishing itself is the real
    // effect). False only for the "can't classify" no-ops enumerated by
    // ai/rules/observability-conventions.md ("unknown machine", and — the
    // same class of no-op — a non-finite temperature), matching how the
    // other three consumers treat those exact cases.
    let processed = true;

    if (event.eventType === 'TEMPERATURE_REPORTED') {
      const { temperature } = event.payload;
      const machine = Number.isFinite(temperature)
        ? await this.machinesService.findRaw(event.machineId)
        : null;
      if (machine) {
        enrichedEvent = {
          ...event,
          temperatureExceedsThreshold:
            temperature > machine.temperatureThreshold,
        };
      } else {
        // Unknown machine, or a non-finite temperature that can't be
        // compared to any threshold: republish unclassified rather than
        // dropping the event (design.md D3 / spec's "unknown machine"
        // scenario) — downstream consumers already handle an unknown
        // machineId as their own no-op skip, and a missing
        // temperatureExceedsThreshold field reads as "not exceeded" there.
        if (!Number.isFinite(temperature)) {
          this.logger.warn(
            `Skipping temperature classification for non-finite value on event ${event.eventId}`,
          );
        }
        processed = false;
      }
    } else if (event.eventType === 'STATUS_CHANGED') {
      enrichedEvent = {
        ...event,
        isSensorFailure: event.payload.currentStatus === 'WARNING',
      };
    }

    await this.kafkaProducerService.publish(
      env.kafkaTopicMachineEventsEnriched,
      event.machineId,
      enrichedEvent,
    );

    return processed;
  }
}
