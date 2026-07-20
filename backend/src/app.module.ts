import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { MachinesModule } from './machines/machines.module';
import { AlertsModule } from './alerts/alerts.module';
import { RulesModule } from './rules/rules.module';
import { InsightsModule } from './insights/insights.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SimulatorModule } from './simulator/simulator.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    // Structured JSON access logging (method/path/status/duration) via
    // pino-http's default request logging. trace_id/span_id log injection
    // comes from instrumentation.ts's OTel pino instrumentation, not
    // configured here (design.md D2).
    LoggerModule.forRoot(),
    EventsModule,
    MachinesModule,
    AlertsModule,
    RulesModule,
    InsightsModule,
    DashboardModule,
    SimulatorModule,
    SharedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
