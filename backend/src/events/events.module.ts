import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MachinesModule } from '../machines/machines.module';
import {
  MachineEvent,
  MachineEventSchema,
} from './schemas/machine-event.schema';
import { EventConsumerService } from './event-consumer.service';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsListController } from './events-list.controller';

@Module({
  imports: [
    MachinesModule,
    MongooseModule.forFeature([
      { name: MachineEvent.name, schema: MachineEventSchema },
    ]),
  ],
  controllers: [EventsController, EventsListController],
  providers: [EventConsumerService, EventsService],
})
export class EventsModule {}
