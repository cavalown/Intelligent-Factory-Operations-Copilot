import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const SUMMARY_SCOPES = ['MACHINE', 'FACTORY'] as const;
export type SummaryScope = (typeof SUMMARY_SCOPES)[number];

export type AiSummaryDocument = HydratedDocument<AiSummary>;

// Matches docs/design/api.md §4.6; factory-scope documents are identical
// except scope: "FACTORY" and no machineId (add-insights-module design D5).
@Schema({ collection: 'ai_summaries' })
export class AiSummary {
  @Prop({ required: true, unique: true })
  summaryId: string;

  @Prop({ type: String, default: null })
  machineId: string | null;

  @Prop({ type: String, required: true, enum: SUMMARY_SCOPES })
  scope: SummaryScope;

  @Prop({ type: [String], required: true })
  inputEventIds: string[];

  @Prop({ required: true })
  summary: string;

  @Prop({ type: [String], required: true })
  recommendedActions: string[];

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  createdAt: string;
}

export const AiSummarySchema = SchemaFactory.createForClass(AiSummary);
// Each index matches one "latest summary" lookup exactly — equality prefix,
// then the full sort key (createdAt desc, _id tiebreak) so findOne+sort is
// index-covered instead of an in-memory sort.
AiSummarySchema.index({ scope: 1, machineId: 1, createdAt: -1, _id: -1 });
AiSummarySchema.index({ scope: 1, createdAt: -1, _id: -1 });
