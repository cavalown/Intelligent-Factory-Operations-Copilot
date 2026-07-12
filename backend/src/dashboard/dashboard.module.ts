import { Module } from '@nestjs/common';
import { MachinesModule } from '../machines/machines.module';
import { EventsModule } from '../events/events.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [MachinesModule, EventsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
