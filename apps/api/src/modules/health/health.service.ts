import { Injectable } from '@nestjs/common';
import { RabbitMqService, RedisService } from '@app/integrations';
import { HealthStatusDto } from './dto';
import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository,
    private readonly redisService: RedisService,
    private readonly rabbitMqService: RabbitMqService,
  ) {}

  async getHealthStatus(): Promise<HealthStatusDto> {
    const checks = await Promise.allSettled([
      this.healthRepository.pingDatabase(),
      this.redisService.ping(),
      this.rabbitMqService.ping(),
    ]);

    const services = {
      database: {
        status: toComponentStatus(checks[0].status),
      },
      redis: {
        status: toComponentStatus(checks[1].status),
      },
      rabbitmq: {
        status: toComponentStatus(checks[2].status),
      },
    } as const;

    const hasFailure = checks.some((result) => result.status === 'rejected');

    return {
      status: hasFailure ? 'error' : 'ok',
      timestamp: new Date().toISOString(),
      services,
    };
  }
}

function toComponentStatus(
  status: PromiseSettledResult<unknown>['status'],
): 'up' | 'down' {
  return status === 'fulfilled' ? 'up' : 'down';
}
