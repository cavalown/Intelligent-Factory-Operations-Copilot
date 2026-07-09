import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { InsightsService } from './insights.service';

// docs/design/api.md §4.6–4.7
@Controller('machines/:id/summary')
export class MachineSummaryController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  async getSummary(@Param('id') id: string) {
    return this.insightsService.getLatestMachineSummary(id);
  }

  // §4.7 specifies 200 (not 201): triggering a regeneration is not creating
  // a client-addressable resource.
  @Post()
  @HttpCode(HttpStatus.OK)
  async createSummary(@Param('id') id: string) {
    return this.insightsService.generateMachineSummary(id);
  }
}
