import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MachinesService } from './machines.service';
import {
  MachineStatusTransition,
  MachineStatusTransitionDocument,
} from './schemas/machine-status-transition.schema';
import type { MachineStatus } from './schemas/machine.schema';

export const UTILIZATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface UtilizationBuckets {
  operatingMs: number;
  stoppedMs: number;
  idleMs: number;
}

export interface FactoryUtilization extends UtilizationBuckets {
  // True when any machine's window used the bootstrap approximation (D9).
  approximate: boolean;
}

// Bucket assignment per dashboard-operational-metrics design D2:
// operating = producing (possibly degraded), stopped = not producing and
// needs intervention, idle = neither.
const BUCKET_BY_STATUS: Record<MachineStatus, keyof UtilizationBuckets> = {
  RUNNING: 'operatingMs',
  WARNING: 'operatingMs',
  ERROR: 'stoppedMs',
  MAINTENANCE: 'stoppedMs',
  IDLE: 'idleMs',
};

type LeanTransition = Pick<
  MachineStatusTransition,
  'at' | 'fromStatus' | 'toStatus'
>;

// Rolling-24h time-in-status over the transitions projection
// (dashboard-operational-metrics design D2, hardened per D7/D9/D10).
// Computed on read — trivial at MVP machine counts; the 300-machine path
// (batched cross-machine queries, cached rollups) is documented in design.md.
@Injectable()
export class UtilizationService {
  private readonly logger = new Logger(UtilizationService.name);

  constructor(
    private readonly machinesService: MachinesService,
    @InjectModel(MachineStatusTransition.name)
    private readonly transitionModel: Model<MachineStatusTransitionDocument>,
  ) {}

  // docs/design/api.md §4.12 — GET /machines/:id/utilization
  async getMachineUtilization(machineId: string) {
    // getMachine owns the MACHINE_NOT_FOUND guard and supplies the current
    // status for the no-transitions bootstrap fallback.
    const machine = await this.machinesService.getMachine(machineId);
    const { buckets, approximate } = await this.computeWindow(
      machineId,
      machine.status,
    );
    return {
      machineId,
      windowMs: UTILIZATION_WINDOW_MS,
      ...buckets,
      approximate,
    };
  }

  // Factory-wide sum, consumed by the dashboard module (design D3).
  async getFactoryUtilization(): Promise<FactoryUtilization> {
    const machines = await this.machinesService.listMachines();
    const perMachine = await Promise.all(
      machines.data.map((m) => this.computeWindow(m.machineId, m.status)),
    );

    return perMachine.reduce<FactoryUtilization>(
      (sum, m) => ({
        operatingMs: sum.operatingMs + m.buckets.operatingMs,
        stoppedMs: sum.stoppedMs + m.buckets.stoppedMs,
        idleMs: sum.idleMs + m.buckets.idleMs,
        approximate: sum.approximate || m.approximate,
      }),
      { operatingMs: 0, stoppedMs: 0, idleMs: 0, approximate: false },
    );
  }

  private async computeWindow(
    machineId: string,
    currentStatus: MachineStatus,
  ): Promise<{ buckets: UtilizationBuckets; approximate: boolean }> {
    const now = Date.now();
    const windowStart = now - UTILIZATION_WINDOW_MS;
    const windowStartIso = new Date(windowStart).toISOString();
    const nowIso = new Date(now).toISOString();

    // Ingestion enforces canonical ISO-8601 UTC (design D6), so the string
    // range query is chronologically correct for post-D6 data. The parse
    // guard and numeric re-sort below defend against pre-existing or
    // out-of-band rows (D7 defense-in-depth).
    const inWindowRaw = await this.transitionModel
      .find({ machineId, at: { $gte: windowStartIso, $lte: nowIso } })
      .sort({ at: 1 })
      .select({ at: 1, fromStatus: 1, toStatus: 1, _id: 0 })
      .lean<LeanTransition[]>()
      .exec();

    const inWindow = inWindowRaw
      .map((t) => ({ ...t, atMs: Date.parse(t.at) }))
      .filter((t) => {
        if (!Number.isFinite(t.atMs)) {
          this.logger.warn(
            `Skipping transition with unparseable at="${t.at}" for machine ${machineId}`,
          );
          return false;
        }
        return true;
      })
      .sort((a, b) => a.atMs - b.atMs);

    // Status in effect at window start. The pre-window lookup is only needed
    // when no usable in-window transition exists — inWindow[0].fromStatus
    // already carries the window-start status otherwise (design D10).
    let statusAtStart: MachineStatus;
    let approximate = false;
    if (inWindow.length > 0) {
      statusAtStart = inWindow[0].fromStatus;
    } else {
      const beforeWindow = await this.transitionModel
        .findOne({ machineId, at: { $lt: windowStartIso } })
        .sort({ at: -1 })
        .select({ toStatus: 1, _id: 0 })
        .lean<Pick<MachineStatusTransition, 'toStatus'> | null>()
        .exec();
      if (beforeWindow) {
        statusAtStart = beforeWindow.toStatus;
      } else {
        // Bootstrap approximation (design D2/D9): no history at all — the
        // current status is assumed to span the whole window, and the
        // response is flagged so the UI can annotate it.
        statusAtStart = currentStatus;
        approximate = true;
      }
    }

    const buckets: UtilizationBuckets = {
      operatingMs: 0,
      stoppedMs: 0,
      idleMs: 0,
    };

    let cursor = windowStart;
    let status = statusAtStart;
    for (const transition of inWindow) {
      buckets[BUCKET_BY_STATUS[status]] += Math.max(
        0,
        transition.atMs - cursor,
      );
      cursor = transition.atMs;
      status = transition.toStatus;
    }
    buckets[BUCKET_BY_STATUS[status]] += Math.max(0, now - cursor);

    return { buckets, approximate };
  }
}
