import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MachineEventDocument = HydratedDocument<MachineEvent>;

// Immutable event history, matching docs/design/architecture.md §12.1 —
// exactly the event-schema.md §3 envelope fields, plus createdAt (storage
// timestamp, not part of the envelope contract).
@Schema({ collection: 'machine_events' })
export class MachineEvent {
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  schemaVersion: number;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  machineId: string;

  @Prop({ required: true })
  occurredAt: string;

  @Prop({ required: true })
  producedAt: string;

  @Prop({ type: String })
  correlationId?: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;
}

export const MachineEventSchema = SchemaFactory.createForClass(MachineEvent);
MachineEventSchema.index({ machineId: 1 });
