import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { env } from '../shared/config/env.config';
import { MachinesModule } from '../machines/machines.module';
import { EventsModule } from '../events/events.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AiSummary, AiSummarySchema } from './schemas/ai-summary.schema';
import { LLM_CLIENT } from './llm/llm-client';
import { createLlmClient } from './llm/llm-client.factory';
import { InsightsService } from './insights.service';
import { MachineSummaryController } from './machine-summary.controller';
import { FactorySummaryController } from './factory-summary.controller';

@Module({
  imports: [
    MachinesModule,
    EventsModule,
    AlertsModule,
    MongooseModule.forFeature([
      { name: AiSummary.name, schema: AiSummarySchema },
    ]),
  ],
  controllers: [MachineSummaryController, FactorySummaryController],
  providers: [
    InsightsService,
    {
      provide: LLM_CLIENT,
      // Runs at bootstrap: an unknown LLM_PROVIDER fails startup fast
      // (add-insights-module design D3).
      useFactory: () => createLlmClient(env.llmProvider),
    },
  ],
})
export class InsightsModule {}
