import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiError } from '../shared/errors/api-error';
import { MachinesService } from '../machines/machines.service';
import { EventsService } from '../events/events.service';
import { AlertsService } from '../alerts/alerts.service';
import { LLM_CLIENT } from './llm/llm-client';
// Interface-only imports must be type-only under isolatedModules +
// emitDecoratorMetadata when referenced in a decorated constructor signature.
import type { LlmClient, LlmSummaryResult } from './llm/llm-client';
import {
  buildSummaryPrompt,
  SummaryContext,
  SummaryContextEvent,
} from './prompt-builder';
import {
  AiSummary,
  AiSummaryDocument,
  SummaryScope,
} from './schemas/ai-summary.schema';

// Prompt-context bounds (resolve design.md Open Question 1). Machine scope
// takes the 20 newest events — one dashboard page of history (EventsService's
// DEFAULT_LIMIT). Factory scope samples per machine instead of globally so a
// chatty machine cannot crowd a quiet-but-WARNING machine out of the prompt.
// Active alerts are capped too: the MVP has no resolution workflow, so the
// ACTIVE set only grows.
export const SUMMARY_EVENT_LIMIT = 20;
export const FACTORY_EVENTS_PER_MACHINE = 5;
export const SUMMARY_ALERT_LIMIT = 20;

// Insight Service (docs/design/architecture.md §7.6): explains data owned by
// the Machine/Event/Alert services — reads only through their exported
// services, never their models (add-insights-module design D2).
@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly machinesService: MachinesService,
    private readonly eventsService: EventsService,
    private readonly alertsService: AlertsService,
    @InjectModel(AiSummary.name)
    private readonly aiSummaryModel: Model<AiSummaryDocument>,
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
  ) {}

  // docs/design/api.md §4.7 — synchronous LLM call, no job queue in MVP.
  async generateMachineSummary(machineId: string) {
    const context = await this.gatherMachineContext(machineId);
    return this.generateFromContext(context, machineId);
  }

  // docs/design/api.md §4.10
  async generateFactorySummary() {
    const context = await this.gatherFactoryContext();
    return this.generateFromContext(context, null);
  }

  // docs/design/api.md §4.6 — never calls the LLM.
  async getLatestMachineSummary(machineId: string) {
    await this.machinesService.assertExists(machineId);
    return this.findLatest(
      { scope: 'MACHINE', machineId },
      `No summary has been generated for machine ${machineId} yet.`,
    );
  }

  // docs/design/api.md §4.9 — never calls the LLM.
  async getLatestFactorySummary() {
    return this.findLatest(
      { scope: 'FACTORY' },
      'No factory summary has been generated yet.',
    );
  }

  private async generateFromContext(
    context: SummaryContext,
    machineId: string | null,
  ) {
    const prompt = buildSummaryPrompt(context);

    let result: LlmSummaryResult;
    try {
      result = await this.llmClient.generateSummary(prompt);
    } catch (err) {
      // Advisory-feature failure stays isolated from dashboard availability
      // (architecture.md §16); nothing is persisted for a failed attempt.
      // The cause is logged here because the 502 body is deliberately generic.
      this.logger.error(
        `LLM call failed for ${context.scope} summary${
          machineId ? ` (machine ${machineId})` : ''
        }`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new ApiError(
        HttpStatus.BAD_GATEWAY,
        'LLM_CALL_FAILED',
        'The LLM call failed; the summary was not generated.',
      );
    }

    // new+save instead of Model.create(): the contract field name `model`
    // (api.md §4.6) collides with mongoose's Document typings inside
    // create()'s parameter type; the constructor takes the plain class shape.
    const created = await new this.aiSummaryModel({
      summaryId: `summary_${randomUUID()}`,
      machineId,
      scope: context.scope,
      inputEventIds: context.events.map((e) => e.eventId),
      summary: result.summary,
      recommendedActions: result.recommendedActions,
      model: result.model,
      createdAt: new Date().toISOString(),
    }).save();

    return this.toResponse(created);
  }

  private async findLatest(
    filter: { scope: SummaryScope; machineId?: string },
    notFoundMessage: string,
  ) {
    const summary = await this.aiSummaryModel
      .findOne(filter)
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    if (!summary) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'SUMMARY_NOT_FOUND',
        notFoundMessage,
      );
    }

    return this.toResponse(summary);
  }

  private async gatherMachineContext(
    machineId: string,
  ): Promise<SummaryContext> {
    // The three reads are independent: getMachine owns the MACHINE_NOT_FOUND
    // check (its rejection wins before the unchecked reads' results are used),
    // so they can run in parallel without redundant existence queries.
    const [machine, events, alerts] = await Promise.all([
      this.machinesService.getMachine(machineId),
      this.eventsService.listEventsUnchecked({
        machineId,
        limit: String(SUMMARY_EVENT_LIMIT),
      }),
      this.alertsService.listAlerts({
        machineId,
        status: 'ACTIVE',
        limit: SUMMARY_ALERT_LIMIT,
      }),
    ]);

    return {
      scope: 'MACHINE',
      machines: [machine],
      events: events.data,
      alerts: alerts.data,
    };
  }

  private async gatherFactoryContext(): Promise<SummaryContext> {
    const machines = await this.machinesService.listMachines();

    // Per-machine sampling keeps every machine represented in the prompt;
    // events are re-merged most-recent-first to match the prompt's framing.
    const [perMachineEvents, alerts] = await Promise.all([
      Promise.all(
        machines.data.map((m) =>
          this.eventsService.listEventsUnchecked({
            machineId: m.machineId,
            limit: String(FACTORY_EVENTS_PER_MACHINE),
          }),
        ),
      ),
      this.alertsService.listAlerts({
        status: 'ACTIVE',
        limit: SUMMARY_ALERT_LIMIT,
      }),
    ]);

    const events: SummaryContextEvent[] = perMachineEvents
      .flatMap((page) => page.data)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    return {
      scope: 'FACTORY',
      machines: machines.data,
      events,
      alerts: alerts.data,
    };
  }

  private toResponse(s: AiSummaryDocument) {
    return {
      summaryId: s.summaryId,
      // Factory-scope documents carry no machineId (design D5).
      ...(s.machineId != null ? { machineId: s.machineId } : {}),
      scope: s.scope,
      inputEventIds: s.inputEventIds,
      summary: s.summary,
      recommendedActions: s.recommendedActions,
      model: s.model,
      createdAt: s.createdAt,
    };
  }
}
