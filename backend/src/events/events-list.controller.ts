import { Controller, Get, Query } from '@nestjs/common';
import { EventsService } from './events.service';

// Cross-machine event feed — docs/design/api.md §4.4. Shares EventsService
// with EventsController (scoped to /machines/:id/events).
@Controller('events')
export class EventsListController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getEvents(
    @Query('machineId') machineId?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.eventsService.listEvents({
      machineId,
      limit,
      before,
      eventType,
    });
  }
}
