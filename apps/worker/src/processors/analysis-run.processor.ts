import { AnalysisRequestPayload } from '@app/contracts';
import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  RabbitMqService,
} from '@app/integrations';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AnalysisRunJob } from '../jobs/analysis-run.job';

@Injectable()
export class AnalysisRunProcessor implements OnModuleInit {
  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly analysisRunJob: AnalysisRunJob,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerConsumer(
      RABBITMQ_QUEUES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_REQUEST,
    );
  }

  private async registerConsumer(queue: string, routingKey: string): Promise<void> {
    await this.rabbitMqService.consume<AnalysisRequestPayload>(
      queue,
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      routingKey,
      async (payload: AnalysisRequestPayload): Promise<void> => {
        await this.analysisRunJob.run(payload);
      },
    );
  }
}
