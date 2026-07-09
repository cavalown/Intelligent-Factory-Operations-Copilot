import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { InsightsService } from './insights.service';

// docs/design/api.md §4.9–4.10 — factory-scope summary backing the
// Dashboard's AI Summary Card (add-insights-module proposal).
@Controller('summary')
export class FactorySummaryController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  async getSummary() {
    return this.insightsService.getLatestFactorySummary();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async createSummary() {
    return this.insightsService.generateFactorySummary();
  }
}
