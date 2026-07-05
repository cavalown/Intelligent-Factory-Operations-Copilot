import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SimulatorService } from './simulator.service';

// docs/design/api.md §4.7
@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async publishEvent(@Body() body: Record<string, unknown>) {
    return this.simulatorService.ingestEvent(body);
  }
}
