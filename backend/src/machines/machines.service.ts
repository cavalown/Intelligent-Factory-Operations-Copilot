import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiError } from '../shared/errors/api-error';
import { Machine, MachineDocument } from './schemas/machine.schema';

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
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'MACHINE_NOT_FOUND',
        `Machine ${machineId} was not found.`,
      );
    }
    return this.toResponse(machine);
  }

  async exists(machineId: string): Promise<boolean> {
    return (await this.machineModel.exists({ machineId })) !== null;
  }

  // For other modules' consumers that need machine fields (e.g. threshold)
  // without going through the HTTP-shaped getMachine(). Returns null rather
  // than throwing — consumers should skip silently on an unknown machine.
  async findRaw(machineId: string): Promise<MachineDocument | null> {
    return this.machineModel.findOne({ machineId }).exec();
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
