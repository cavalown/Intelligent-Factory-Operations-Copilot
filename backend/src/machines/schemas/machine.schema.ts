import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Matches docs/design/machine-schema.md §3.
export const MACHINE_STATUSES = [
  'RUNNING',
  'IDLE',
  'WARNING',
  'ERROR',
  'MAINTENANCE',
] as const;

export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export type MachineDocument = HydratedDocument<Machine>;

@Schema({ collection: 'machines' })
export class Machine {
  // Profile fields (machine-schema.md §2) — set at seed time, not derived from events.
  @Prop({ required: true, unique: true })
  machineId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  temperatureThreshold: number;

  // Projection fields — derived from machine_events, per machine-schema.md §4-§7.
  @Prop({ required: true, enum: MACHINE_STATUSES, default: 'IDLE' })
  status: MachineStatus;

  @Prop({ required: true, min: 0, max: 100, default: 100 })
  healthScore: number;

  @Prop({ type: Number, default: null })
  currentTemperature: number | null;

  @Prop({ required: true, default: 0 })
  productionCount: number;

  @Prop({ type: String, default: null })
  lastEventId: string | null;

  @Prop({ type: String, default: null })
  lastUpdatedAt: string | null;
}

export const MachineSchema = SchemaFactory.createForClass(Machine);
