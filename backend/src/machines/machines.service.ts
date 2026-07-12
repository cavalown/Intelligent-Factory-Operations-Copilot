import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiError } from '../shared/errors/api-error';
import {
  Machine,
  MachineDocument,
  MACHINE_STATUSES,
} from './schemas/machine.schema';
import type { MachineStatus } from './schemas/machine.schema';

@Injectable()
export class MachinesService {
  constructor(
    @InjectModel(Machine.name)
    private readonly machineModel: Model<MachineDocument>,
  ) {}

  // docs/design/api.md §4.1
  async listMachines() {
    const machines = await this.machineModel.find().exec();
    return { data: machines.map((m) => this.toResponse(m)) };
  }

  // docs/design/api.md §4.2
  async getMachine(machineId: string) {
    const machine = await this.machineModel.findOne({ machineId }).exec();
    if (!machine) {
      throw this.notFound(machineId);
    }
    return this.toResponse(machine);
  }

  async exists(machineId: string): Promise<boolean> {
    return (await this.machineModel.exists({ machineId })) !== null;
  }

  // Single owner of the MACHINE_NOT_FOUND guard — other modules call this
  // instead of copying the exists+throw block (docs/design/api.md §6).
  async assertExists(machineId: string): Promise<void> {
    if (!(await this.exists(machineId))) {
      throw this.notFound(machineId);
    }
  }

  private notFound(machineId: string): ApiError {
    return new ApiError(
      HttpStatus.NOT_FOUND,
      'MACHINE_NOT_FOUND',
      `Machine ${machineId} was not found.`,
    );
  }

  // For other modules' consumers that need machine fields (e.g. threshold)
  // without going through the HTTP-shaped getMachine(). Returns null rather
  // than throwing — consumers should skip silently on an unknown machine.
  async findRaw(machineId: string): Promise<MachineDocument | null> {
    return this.machineModel.findOne({ machineId }).exec();
  }

  // docs/design/api.md — GET /dashboard/stats (add-frontend-mvp design D4).
  // One aggregation over the projection; statusCounts is always zero-filled
  // for all five statuses so clients never branch on missing keys.
  async getDashboardStats() {
    const [row] = await this.machineModel.aggregate<{
      machineCount: number;
      totalProductionCount: number;
      averageHealthScore: number;
      statuses: MachineStatus[];
    }>([
      {
        $group: {
          _id: null,
          machineCount: { $sum: 1 },
          totalProductionCount: { $sum: '$productionCount' },
          averageHealthScore: { $avg: '$healthScore' },
          statuses: { $push: '$status' },
        },
      },
    ]);

    const statusCounts = Object.fromEntries(
      MACHINE_STATUSES.map((s) => [s, 0]),
    ) as Record<MachineStatus, number>;
    for (const status of row?.statuses ?? []) {
      statusCounts[status] += 1;
    }

    return {
      machineCount: row?.machineCount ?? 0,
      statusCounts,
      totalProductionCount: row?.totalProductionCount ?? 0,
      averageHealthScore:
        row === undefined ? null : Math.round(row.averageHealthScore * 10) / 10,
    };
  }

  private toResponse(m: MachineDocument) {
    return {
      machineId: m.machineId,
      name: m.name,
      temperatureThreshold: m.temperatureThreshold,
      status: m.status,
      healthScore: m.healthScore,
      currentTemperature: m.currentTemperature,
      productionCount: m.productionCount,
      lastEventId: m.lastEventId,
      lastUpdatedAt: m.lastUpdatedAt,
    };
  }
}
