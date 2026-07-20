import { Module } from '@nestjs/common';
import { MachinesModule } from '../machines/machines.module';
import { RuleEngineConsumerService } from './rule-engine-consumer.service';

// Rule Engine: computes classification once and republishes to
// machine.events.enriched. Owns no persistence (module-boundaries.md).
// See openspec/changes/add-rule-engine/design.md D4.
@Module({
  imports: [MachinesModule],
  providers: [RuleEngineConsumerService],
})
export class RulesModule {}
