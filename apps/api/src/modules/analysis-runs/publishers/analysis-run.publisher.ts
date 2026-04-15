import { Injectable } from '@nestjs/common';
import { AnalysisRunsEntity } from '@app/database';
import { AnalysisRequestPayload } from '@app/contracts';
import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  RabbitMqService,
} from '@app/integrations';

@Injectable()
export class AnalysisRunPublisher {
  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async publishRequested(analysisRun: AnalysisRunsEntity): Promise<void> {
    const payload: AnalysisRequestPayload = {
      analysisRunId: analysisRun.id,
      applicantId: analysisRun.applicantId,
      repositoryId: analysisRun.repositoryId,
      requestedByUserId: analysisRun.requestedByUserId,
      requestedAt: new Date().toISOString(),
    };

    await this.rabbitMqService.publish(
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_REQUEST,
      payload,
    );
  }
}
