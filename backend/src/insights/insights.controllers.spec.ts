import { FactorySummaryController } from './factory-summary.controller';
import { MachineSummaryController } from './machine-summary.controller';
import { InsightsService } from './insights.service';

describe('summary controllers', () => {
  let insightsService: {
    getLatestMachineSummary: jest.Mock;
    getLatestFactorySummary: jest.Mock;
    generateMachineSummary: jest.Mock;
    generateFactorySummary: jest.Mock;
  };

  beforeEach(() => {
    insightsService = {
      getLatestMachineSummary: jest.fn().mockResolvedValue({ summaryId: 's1' }),
      getLatestFactorySummary: jest.fn().mockResolvedValue({ summaryId: 's1' }),
      generateMachineSummary: jest.fn().mockResolvedValue({ summaryId: 's2' }),
      generateFactorySummary: jest.fn().mockResolvedValue({ summaryId: 's2' }),
    };
  });

  it('GET /machines/:id/summary reads the latest machine summary', async () => {
    const controller = new MachineSummaryController(
      insightsService as unknown as InsightsService,
    );
    await expect(controller.getSummary('M-001')).resolves.toEqual({
      summaryId: 's1',
    });
    expect(insightsService.getLatestMachineSummary).toHaveBeenCalledWith(
      'M-001',
    );
    expect(insightsService.generateMachineSummary).not.toHaveBeenCalled();
  });

  it('POST /machines/:id/summary triggers machine-scope generation', async () => {
    const controller = new MachineSummaryController(
      insightsService as unknown as InsightsService,
    );
    await expect(controller.createSummary('M-001')).resolves.toEqual({
      summaryId: 's2',
    });
    expect(insightsService.generateMachineSummary).toHaveBeenCalledWith(
      'M-001',
    );
  });

  it('GET /summary reads the latest factory summary', async () => {
    const controller = new FactorySummaryController(
      insightsService as unknown as InsightsService,
    );
    await expect(controller.getSummary()).resolves.toEqual({ summaryId: 's1' });
    expect(insightsService.getLatestFactorySummary).toHaveBeenCalled();
    expect(insightsService.generateFactorySummary).not.toHaveBeenCalled();
  });

  it('POST /summary triggers factory-scope generation', async () => {
    const controller = new FactorySummaryController(
      insightsService as unknown as InsightsService,
    );
    await expect(controller.createSummary()).resolves.toEqual({
      summaryId: 's2',
    });
    expect(insightsService.generateFactorySummary).toHaveBeenCalled();
  });
});
