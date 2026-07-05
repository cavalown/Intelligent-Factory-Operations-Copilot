import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { MachinesModule } from './machines/machines.module';
import { AlertsModule } from './alerts/alerts.module';
import { InsightsModule } from './insights/insights.module';
import { SimulatorModule } from './simulator/simulator.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [EventsModule, MachinesModule, AlertsModule, InsightsModule, SimulatorModule, SharedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
