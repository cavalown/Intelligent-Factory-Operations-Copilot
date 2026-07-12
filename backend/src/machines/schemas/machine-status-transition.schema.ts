import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MACHINE_STATUSES } from '../../shared/types/machine-status.types';
import type { MachineStatus } from '../../shared/types/machine-status.types';

export type MachineStatusTransitionDocument =
  HydratedDocument<MachineStatusTransition>;

// Rebuildable projection of projected-status changes, written by the machines
// projection consumer (dashboard-operational-metrics design D1). Replaying
// machine_events through the consumer reproduces this collection exactly —
// it is derived state, not new truth.
@Schema({ collection: 'machine_status_transitions' })
export class MachineStatusTransition {
  @Prop({ required: true })
  machineId: string;

  @Prop({ type: String, required: true, enum: MACHINE_STATUSES })
  fromStatus: MachineStatus;

  @Prop({ type: String, required: true, enum: MACHINE_STATUSES })
  toStatus: MachineStatus;

  // The event's occurredAt — utilization arithmetic uses field time, not
  // processing time.
  @Prop({ required: true })
  at: string;

  // One transition per driving event (idempotency, key design rule 4).
  @Prop({ required: true, unique: true })
  eventId: string;
}

export const MachineStatusTransitionSchema = SchemaFactory.createForClass(
  MachineStatusTransition,
);
MachineStatusTransitionSchema.index({ machineId: 1, at: -1 });
