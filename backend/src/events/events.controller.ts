import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('machines/:id/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getEvents(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.eventsService.listEventsForMachine(id, {
      limit,
      before,
      eventType,
    });
  }
}
