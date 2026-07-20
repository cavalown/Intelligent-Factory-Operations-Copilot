import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const ALERT_SEVERITIES = ['WARNING', 'CRITICAL'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export type AlertDocument = HydratedDocument<Alert>;

// Matches docs/design/architecture.md §12.3.
@Schema({ collection: 'alerts' })
export class Alert {
  @Prop({ required: true })
  alertId: string;

  @Prop({ required: true })
  machineId: string;

  // One event produces at most one alert in the current design — see
  // openspec/changes/backend-walking-skeleton/design.md Decisions.
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ type: String, required: true, enum: ALERT_SEVERITIES })
  severity: AlertSeverity;

  @Prop({
    type: String,
    required: true,
    enum: ALERT_STATUSES,
    default: 'ACTIVE',
  })
  status: AlertStatus;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  createdAt: string;

  @Prop({ type: String, default: null })
  acknowledgedAt: string | null;

  @Prop({ type: String, default: null })
  resolvedAt: string | null;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
AlertSchema.index({ machineId: 1 });
