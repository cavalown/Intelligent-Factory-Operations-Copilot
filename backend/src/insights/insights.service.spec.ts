import { HttpStatus } from '@nestjs/common';
import { ApiError } from '../shared/errors/api-error';
import { InsightsService } from './insights.service';

const machine = {
  machineId: 'M-001',
  name: 'CNC Mill 01',
  status: 'WARNING',
  healthScore: 78,
  currentTemperature: 95,
  productionCount: 142,
};

const machineTwo = {
  ...machine,
  machineId: 'M-002',
  name: 'CNC Mill 02',
  status: 'RUNNING',
};

const eventsPage = {
  data: [
    {
      eventId: 'evt_temp_001',
      eventType: 'TEMPERATURE_REPORTED',
      machineId: 'M-001',
      occurredAt: '2026-07-10T10:30:00.000Z',
      payload: { temperature: 95, unit: 'C' },
    },
    {
      eventId: 'evt_prod_098',
      eventType: 'PRODUCTION_COMPLETED',
      machineId: 'M-001',
      occurredAt: '2026-07-10T10:29:00.000Z',
      payload: { unitsProduced: 1 },
    },
  ],
  pagination: { limit: 20, nextCursor: null, hasMore: false },
};

const llmResult = {
  summary: 'Machine reported an over-threshold temperature.',
  recommendedActions: ['Check cooling system airflow.'],
  model: 'mock',
};

function expectApiError(err: unknown, status: number, code: string) {
  expect(err).toBeInstanceOf(ApiError);
  const apiError = err as ApiError;
  expect(apiError.getStatus()).toBe(status);
  expect(
    (apiError.getResponse() as { error: { code: string } }).error.code,
  ).toBe(code);
}

describe('InsightsService', () => {
  let machinesService: {
    getMachine: jest.Mock;
    listMachines: jest.Mock;
    assertExists: jest.Mock;
  };
  let eventsService: { listEventsUnchecked: jest.Mock };
  let alertsService: { listAlerts: jest.Mock };
  let llmClient: { generateSummary: jest.Mock };
  let aiSummaryModel: jest.Mock & { findOne: jest.Mock };
  let service: InsightsService;

  function mockFindOneResult(doc: unknown) {
    aiSummaryModel.findOne.mockReturnValue({
      sort: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) }),
    });
  }

  beforeEach(() => {
    machinesService = {
      getMachine: jest.fn().mockResolvedValue(machine),
      listMachines: jest
        .fn()
        .mockResolvedValue({ data: [machine, machineTwo] }),
      assertExists: jest.fn().mockResolvedValue(undefined),
    };
    eventsService = {
      listEventsUnchecked: jest.fn().mockResolvedValue(eventsPage),
    };
    alertsService = { listAlerts: jest.fn().mockResolvedValue({ data: [] }) };
    llmClient = { generateSummary: jest.fn().mockResolvedValue(llmResult) };

    const modelConstructor = jest.fn().mockImplementation((doc: object) => ({
      ...doc,
      save: jest.fn().mockResolvedValue(doc),
    }));
    aiSummaryModel = Object.assign(modelConstructor, { findOne: jest.fn() });

    service = new InsightsService(
      machinesService as never,
      eventsService as never,
      alertsService as never,
      aiSummaryModel as never,
      llmClient,
    );
  });

  describe('generateMachineSummary', () => {
    it('persists and returns a machine-scope summary', async () => {
      const result = await service.generateMachineSummary('M-001');

      expect(machinesService.getMachine).toHaveBeenCalledWith('M-001');
      expect(eventsService.listEventsUnchecked).toHaveBeenCalledWith({
        machineId: 'M-001',
        limit: '20',
      });
      expect(alertsService.listAlerts).toHaveBeenCalledWith({
        machineId: 'M-001',
        status: 'ACTIVE',
        limit: 20,
      });
      expect(aiSummaryModel).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'MACHINE',
          machineId: 'M-001',
          summary: llmResult.summary,
          recommendedActions: llmResult.recommendedActions,
          model: 'mock',
        }),
      );
      expect(result).toMatchObject({
        scope: 'MACHINE',
        machineId: 'M-001',
        summary: llmResult.summary,
      });
    });

    it('records inputEventIds matching the events fed to the prompt', async () => {
      const result = await service.generateMachineSummary('M-001');

      expect(result.inputEventIds).toEqual(['evt_temp_001', 'evt_prod_098']);
      const [[prompt]] = llmClient.generateSummary.mock.calls as [[string]];
      expect(prompt).toContain('TEMPERATURE_REPORTED');
      expect(prompt).toContain('PRODUCTION_COMPLETED');
    });

    it('propagates MACHINE_NOT_FOUND before calling the LLM', async () => {
      machinesService.getMachine.mockRejectedValue(
        new ApiError(
          HttpStatus.NOT_FOUND,
          'MACHINE_NOT_FOUND',
          'Machine M-999 was not found.',
        ),
      );

      await expect(
        service.generateMachineSummary('M-999'),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
      expect(llmClient.generateSummary).not.toHaveBeenCalled();
      expect(aiSummaryModel).not.toHaveBeenCalled();
    });

    it('maps LLM failure to 502 LLM_CALL_FAILED and persists nothing', async () => {
      llmClient.generateSummary.mockRejectedValue(new Error('provider down'));

      try {
        await service.generateMachineSummary('M-001');
        fail('expected ApiError');
      } catch (err) {
        expectApiError(err, HttpStatus.BAD_GATEWAY, 'LLM_CALL_FAILED');
      }
      expect(aiSummaryModel).not.toHaveBeenCalled();
    });
  });

  describe('generateFactorySummary', () => {
    it('persists a factory-scope summary with no machineId in the response', async () => {
      const result = await service.generateFactorySummary();

      expect(machinesService.listMachines).toHaveBeenCalled();
      expect(alertsService.listAlerts).toHaveBeenCalledWith({
        status: 'ACTIVE',
        limit: 20,
      });
      expect(aiSummaryModel).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'FACTORY', machineId: null }),
      );
      expect(result.scope).toBe('FACTORY');
      expect(result).not.toHaveProperty('machineId');
    });

    it('samples events per machine and merges them most-recent-first', async () => {
      const olderEvent = {
        eventId: 'evt_old_002',
        eventType: 'PRODUCTION_COMPLETED',
        machineId: 'M-002',
        occurredAt: '2026-07-10T09:00:00.000Z',
        payload: {},
      };
      const newerEvent = {
        eventId: 'evt_new_002',
        eventType: 'ERROR_OCCURRED',
        machineId: 'M-002',
        occurredAt: '2026-07-10T11:00:00.000Z',
        payload: { errorCode: 'E42' },
      };
      eventsService.listEventsUnchecked
        .mockResolvedValueOnce(eventsPage)
        .mockResolvedValueOnce({ data: [newerEvent, olderEvent] });

      const result = await service.generateFactorySummary();

      expect(eventsService.listEventsUnchecked).toHaveBeenCalledWith({
        machineId: 'M-001',
        limit: '5',
      });
      expect(eventsService.listEventsUnchecked).toHaveBeenCalledWith({
        machineId: 'M-002',
        limit: '5',
      });
      expect(result.inputEventIds).toEqual([
        'evt_new_002',
        'evt_temp_001',
        'evt_prod_098',
        'evt_old_002',
      ]);
    });
  });

  describe('getLatest*Summary', () => {
    const storedSummary = {
      summaryId: 'summary_001',
      machineId: 'M-001',
      scope: 'MACHINE',
      inputEventIds: ['evt_temp_001'],
      summary: 'Previously stored summary.',
      recommendedActions: [],
      model: 'mock',
      createdAt: '2026-07-10T10:31:00.000Z',
    };

    it('returns the latest machine summary without calling the LLM', async () => {
      mockFindOneResult(storedSummary);

      const result = await service.getLatestMachineSummary('M-001');

      expect(result).toMatchObject({
        summaryId: 'summary_001',
        machineId: 'M-001',
      });
      expect(aiSummaryModel.findOne).toHaveBeenCalledWith({
        scope: 'MACHINE',
        machineId: 'M-001',
      });
      expect(llmClient.generateSummary).not.toHaveBeenCalled();
    });

    it('returns the latest factory summary filtered by scope only', async () => {
      mockFindOneResult({
        ...storedSummary,
        machineId: null,
        scope: 'FACTORY',
      });

      const result = await service.getLatestFactorySummary();

      expect(aiSummaryModel.findOne).toHaveBeenCalledWith({ scope: 'FACTORY' });
      expect(result.scope).toBe('FACTORY');
      expect(result).not.toHaveProperty('machineId');
    });

    it('throws SUMMARY_NOT_FOUND when nothing is stored', async () => {
      mockFindOneResult(null);

      try {
        await service.getLatestMachineSummary('M-001');
        fail('expected ApiError');
      } catch (err) {
        expectApiError(err, HttpStatus.NOT_FOUND, 'SUMMARY_NOT_FOUND');
      }
    });

    it('throws MACHINE_NOT_FOUND for an unknown machine', async () => {
      machinesService.assertExists.mockRejectedValue(
        new ApiError(
          HttpStatus.NOT_FOUND,
          'MACHINE_NOT_FOUND',
          'Machine M-999 was not found.',
        ),
      );

      try {
        await service.getLatestMachineSummary('M-999');
        fail('expected ApiError');
      } catch (err) {
        expectApiError(err, HttpStatus.NOT_FOUND, 'MACHINE_NOT_FOUND');
      }
      expect(aiSummaryModel.findOne).not.toHaveBeenCalled();
    });

    it('still serves the stored summary after a failed regeneration', async () => {
      llmClient.generateSummary.mockRejectedValue(new Error('provider down'));
      await expect(
        service.generateMachineSummary('M-001'),
      ).rejects.toBeInstanceOf(ApiError);

      mockFindOneResult(storedSummary);
      const result = await service.getLatestMachineSummary('M-001');
      expect(result.summary).toBe('Previously stored summary.');
    });
  });
});
