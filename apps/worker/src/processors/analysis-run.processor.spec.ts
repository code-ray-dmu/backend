import { AnalysisRequestPayload } from '@app/contracts';
import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  RabbitMqService,
} from '@app/integrations';
import { Test } from '@nestjs/testing';
import { AnalysisRunJob } from '../jobs/analysis-run.job';
import { AnalysisRunProcessor } from './analysis-run.processor';

describe('AnalysisRunProcessor', () => {
  let processor: AnalysisRunProcessor;
  let rabbitMqService: {
    consume: jest.Mock;
  };
  let analysisRunJob: {
    run: jest.Mock;
  };

  beforeEach(async () => {
    rabbitMqService = {
      consume: jest.fn(),
    };
    analysisRunJob = {
      run: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalysisRunProcessor,
        {
          provide: RabbitMqService,
          useValue: rabbitMqService,
        },
        {
          provide: AnalysisRunJob,
          useValue: analysisRunJob,
        },
      ],
    }).compile();

    processor = moduleRef.get(AnalysisRunProcessor);
  });

  it('registers consumer with analysis request topology and delegates payload to job', async () => {
    let consumer: ((payload: AnalysisRequestPayload) => Promise<void>) | undefined;
    rabbitMqService.consume.mockImplementation(
      async (
        _queue: string,
        _exchange: string,
        _routingKey: string,
        handler: (payload: AnalysisRequestPayload) => Promise<void>,
      ) => {
        consumer = handler;
      },
    );
    analysisRunJob.run.mockResolvedValue(undefined);

    await processor.onModuleInit();
    const payload: AnalysisRequestPayload = {
      analysisRunId: 'run-queue',
      applicantId: 'applicant-1',
      repositoryId: 'repo-1',
      requestedAt: '2026-04-15T00:00:00.000Z',
      requestedByUserId: 'user-1',
    };
    await consumer?.(payload);

    expect(rabbitMqService.consume).toHaveBeenCalledTimes(1);
    expect(rabbitMqService.consume).toHaveBeenCalledWith(
      RABBITMQ_QUEUES.ANALYSIS_REQUEST,
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_REQUEST,
      expect.any(Function),
    );
    expect(analysisRunJob.run).toHaveBeenCalledWith(payload);
  });

  it('surfaces job errors to consume flow', async () => {
    let consumer: ((payload: AnalysisRequestPayload) => Promise<void>) | undefined;
    rabbitMqService.consume.mockImplementation(
      async (
        _queue: string,
        _exchange: string,
        _routingKey: string,
        handler: (payload: AnalysisRequestPayload) => Promise<void>,
      ) => {
        consumer = handler;
      },
    );
    analysisRunJob.run.mockRejectedValue(new Error('Concurrent analysis in progress'));

    await processor.onModuleInit();
    const payload: AnalysisRequestPayload = {
      analysisRunId: 'run-failed',
      applicantId: 'applicant-1',
      repositoryId: 'repo-1',
      requestedAt: '2026-04-15T00:00:00.000Z',
      requestedByUserId: 'user-1',
    };

    await expect(consumer?.(payload)).rejects.toThrow('Concurrent analysis in progress');
  });

  it('propagates consumer registration errors on module init', async () => {
    rabbitMqService.consume.mockRejectedValue(new Error('RabbitMQ unavailable'));

    await expect(processor.onModuleInit()).rejects.toThrow('RabbitMQ unavailable');
    expect(analysisRunJob.run).not.toHaveBeenCalled();
  });
});
