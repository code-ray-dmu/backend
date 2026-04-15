import { AnalysisRunStatus } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  RabbitMqService,
} from '@app/integrations';
import { AnalysisRunPublisher } from './analysis-run.publisher';

describe('AnalysisRunPublisher', () => {
  it('publishes the analysis request payload with the expected contract', async () => {
    const rabbitMqService = {
      publish: jest.fn(),
    } as unknown as RabbitMqService;
    const publisher = new AnalysisRunPublisher(rabbitMqService);
    const analysisRun = {
      id: 'run-1',
      applicantId: 'applicant-1',
      repositoryId: 'repository-1',
      requestedByUserId: 'user-1',
      status: AnalysisRunStatus.QUEUED,
    } as AnalysisRunsEntity;

    await publisher.publishRequested(analysisRun);

    expect(rabbitMqService.publish).toHaveBeenCalledTimes(1);
    expect(rabbitMqService.publish).toHaveBeenCalledWith(
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_REQUEST,
      {
        analysisRunId: 'run-1',
        applicantId: 'applicant-1',
        repositoryId: 'repository-1',
        requestedByUserId: 'user-1',
        requestedAt: expect.any(String),
      },
    );
  });
});
