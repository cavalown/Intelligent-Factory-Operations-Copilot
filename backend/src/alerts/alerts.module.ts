import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MachinesModule } from '../machines/machines.module';
import { Alert, AlertSchema } from './schemas/alert.schema';
import { AlertConsumerService } from './alert-consumer.service';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [
    MachinesModule,
    MongooseModule.forFeature([{ name: Alert.name, schema: AlertSchema }]),
  ],
  controllers: [AlertsController],
  providers: [AlertConsumerService, AlertsService],
  // Consumed by the Insight Service's context gatherer (add-insights-module design D2).
  exports: [AlertsService],
})
export class AlertsModule {}
