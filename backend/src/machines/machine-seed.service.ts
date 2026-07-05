import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Machine, MachineDocument } from './schemas/machine.schema';

// Fixed demo roster, per docs/design/machine-schema.md §11: machines are
// pre-seeded, not auto-created from unknown machineIds.
const DEMO_MACHINES: Array<
  Pick<Machine, 'machineId' | 'name' | 'temperatureThreshold'>
> = [
  { machineId: 'M-001', name: 'CNC Mill 01', temperatureThreshold: 80 },
  { machineId: 'M-002', name: 'CNC Mill 02', temperatureThreshold: 80 },
  { machineId: 'M-003', name: 'Injection Molder 01', temperatureThreshold: 90 },
];

@Injectable()
export class MachineSeedService implements OnModuleInit {
  private readonly logger = new Logger(MachineSeedService.name);

  constructor(
    @InjectModel(Machine.name)
    private readonly machineModel: Model<MachineDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const demo of DEMO_MACHINES) {
      // $setOnInsert + upsert: re-running the seed never resets a machine
      // that events have already changed the state of.
      await this.machineModel.updateOne(
        { machineId: demo.machineId },
        {
          $setOnInsert: {
            machineId: demo.machineId,
            name: demo.name,
            temperatureThreshold: demo.temperatureThreshold,
            status: 'IDLE',
            healthScore: 100,
            currentTemperature: null,
            productionCount: 0,
            lastEventId: null,
            lastUpdatedAt: null,
          },
        },
        { upsert: true },
      );
    }
    this.logger.log(`Seeded ${DEMO_MACHINES.length} demo machines`);
  }
}
