import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Machine, MachineSchema } from './schemas/machine.schema';
import {
  MachineStatusTransition,
  MachineStatusTransitionSchema,
} from './schemas/machine-status-transition.schema';
import { MachineSeedService } from './machine-seed.service';
import { MachineProjectionConsumerService } from './machine-projection-consumer.service';
import { MachinesService } from './machines.service';
import { MachinesController } from './machines.controller';
import { UtilizationService } from './utilization.service';
import { UtilizationController } from './utilization.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Machine.name, schema: MachineSchema },
      {
        name: MachineStatusTransition.name,
        schema: MachineStatusTransitionSchema,
      },
    ]),
  ],
  controllers: [MachinesController, UtilizationController],
  providers: [
    MachineSeedService,
    MachineProjectionConsumerService,
    MachinesService,
    UtilizationService,
  ],
  // UtilizationService is consumed by the dashboard composition module
  // (dashboard-operational-metrics design D3).
  exports: [MachinesService, UtilizationService],
})
export class MachinesModule {}
