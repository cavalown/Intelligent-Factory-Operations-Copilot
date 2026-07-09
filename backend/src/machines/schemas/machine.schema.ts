import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MACHINE_STATUSES } from '../../shared/types/machine-status.types';
import type { MachineStatus } from '../../shared/types/machine-status.types';

// Re-exported so existing in-module imports (`./schemas/machine.schema`)
// keep working — canonical definition now lives in shared/ since simulator/
// also needs it. See shared/types/machine-status.types.ts.
export { MACHINE_STATUSES };
export type { MachineStatus };

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
  @Prop({
    type: String,
    required: true,
    enum: MACHINE_STATUSES,
    default: 'IDLE',
  })
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
