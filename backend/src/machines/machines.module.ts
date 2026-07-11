import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Machine, MachineSchema } from './schemas/machine.schema';
import { MachineSeedService } from './machine-seed.service';
import { MachineProjectionConsumerService } from './machine-projection-consumer.service';
import { MachinesService } from './machines.service';
import { MachinesController } from './machines.controller';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Machine.name, schema: MachineSchema }]),
  ],
  controllers: [MachinesController, DashboardController],
  providers: [
    MachineSeedService,
    MachineProjectionConsumerService,
    MachinesService,
  ],
  exports: [MachinesService],
})
export class MachinesModule {}
